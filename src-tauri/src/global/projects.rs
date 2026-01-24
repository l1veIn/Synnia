//! Project registry management.
//!
//! Manages the list of known projects with status tracking.

use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::path::Path;

use crate::core::AppError;

/// Project status
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProjectStatus {
    Valid,
    Missing,
    Corrupted,
}

impl ProjectStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            ProjectStatus::Valid => "valid",
            ProjectStatus::Missing => "missing",
            ProjectStatus::Corrupted => "corrupted",
        }
    }
    
    pub fn from_str(s: &str) -> Self {
        match s {
            "missing" => ProjectStatus::Missing,
            "corrupted" => ProjectStatus::Corrupted,
            _ => ProjectStatus::Valid,
        }
    }
}

/// Project information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub thumbnail: Option<String>,
    pub last_opened: i64,
    pub created_at: i64,
    pub is_pinned: bool,
    pub status: ProjectStatus,
}

/// Register a new project or update existing.
/// Returns the project ID.
pub fn register_project(
    conn: &Connection, 
    path: &str, 
    name: &str
) -> Result<String, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();
    
    conn.execute(
        "INSERT INTO projects (id, name, path, last_opened, created_at, status)
         VALUES (?1, ?2, ?3, ?4, ?5, 'valid')
         ON CONFLICT(path) DO UPDATE SET 
             name = excluded.name,
             last_opened = excluded.last_opened,
             status = 'valid'",
        params![id, name, path, now, now]
    ).map_err(|e| AppError::Database(format!("Failed to register project: {}", e)))?;
    
    // Get the actual ID (may be existing if path conflict)
    let actual_id: String = conn.query_row(
        "SELECT id FROM projects WHERE path = ?1",
        params![path],
        |row| row.get(0)
    ).map_err(|e| AppError::Database(format!("Failed to get project ID: {}", e)))?;
    
    Ok(actual_id)
}

/// List all projects, ordered by last_opened descending.
pub fn list_projects(
    conn: &Connection, 
    limit: Option<i32>
) -> Result<Vec<ProjectInfo>, AppError> {
    let limit = limit.unwrap_or(50);
    
    let mut stmt = conn.prepare(
        "SELECT id, name, path, thumbnail, last_opened, created_at, is_pinned, status
         FROM projects
         ORDER BY is_pinned DESC, last_opened DESC
         LIMIT ?1"
    ).map_err(|e| AppError::Database(format!("Failed to prepare query: {}", e)))?;
    
    let projects = stmt.query_map(params![limit], |row| {
        Ok(ProjectInfo {
            id: row.get(0)?,
            name: row.get(1)?,
            path: row.get(2)?,
            thumbnail: row.get(3)?,
            last_opened: row.get(4)?,
            created_at: row.get(5)?,
            is_pinned: row.get::<_, i32>(6)? != 0,
            status: ProjectStatus::from_str(&row.get::<_, String>(7)?),
        })
    }).map_err(|e| AppError::Database(format!("Query failed: {}", e)))?
    .filter_map(|r| r.ok())
    .collect();
    
    Ok(projects)
}

/// Update the last_opened timestamp for a project.
pub fn update_last_opened(conn: &Connection, path: &str) -> Result<(), AppError> {
    let now = chrono::Utc::now().timestamp_millis();
    
    conn.execute(
        "UPDATE projects SET last_opened = ?1 WHERE path = ?2",
        params![now, path]
    ).map_err(|e| AppError::Database(format!("Failed to update last_opened: {}", e)))?;
    
    Ok(())
}

/// Remove a project from the registry.
pub fn remove_project(conn: &Connection, path: &str) -> Result<bool, AppError> {
    let deleted = conn.execute(
        "DELETE FROM projects WHERE path = ?1",
        params![path]
    ).map_err(|e| AppError::Database(format!("Failed to remove project: {}", e)))?;
    
    Ok(deleted > 0)
}

/// Toggle pinned status for a project.
pub fn toggle_pinned(conn: &Connection, path: &str) -> Result<bool, AppError> {
    conn.execute(
        "UPDATE projects SET is_pinned = NOT is_pinned WHERE path = ?1",
        params![path]
    ).map_err(|e| AppError::Database(format!("Failed to toggle pinned: {}", e)))?;
    
    let is_pinned: bool = conn.query_row(
        "SELECT is_pinned FROM projects WHERE path = ?1",
        params![path],
        |row| Ok(row.get::<_, i32>(0)? != 0)
    ).map_err(|e| AppError::Database(format!("Failed to get pinned status: {}", e)))?;
    
    Ok(is_pinned)
}

/// Validate all projects and update their status.
/// Checks if project paths still exist.
pub fn validate_projects(conn: &Connection) -> Result<ValidateResult, AppError> {
    let projects = list_projects(conn, None)?;
    let mut updated = 0;
    
    for project in projects {
        let path = Path::new(&project.path);
        let new_status = if path.exists() {
            ProjectStatus::Valid
        } else {
            ProjectStatus::Missing
        };
        
        if new_status != project.status {
            conn.execute(
                "UPDATE projects SET status = ?1 WHERE id = ?2",
                params![new_status.as_str(), project.id]
            ).map_err(|e| AppError::Database(format!("Failed to update status: {}", e)))?;
            updated += 1;
        }
    }
    
    Ok(ValidateResult { updated })
}

#[derive(Debug, Serialize)]
pub struct ValidateResult {
    pub updated: i32,
}

/// Get a project by path.
pub fn get_project_by_path(conn: &Connection, path: &str) -> Result<Option<ProjectInfo>, AppError> {
    let result = conn.query_row(
        "SELECT id, name, path, thumbnail, last_opened, created_at, is_pinned, status
         FROM projects WHERE path = ?1",
        params![path],
        |row| {
            Ok(ProjectInfo {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                thumbnail: row.get(3)?,
                last_opened: row.get(4)?,
                created_at: row.get(5)?,
                is_pinned: row.get::<_, i32>(6)? != 0,
                status: ProjectStatus::from_str(&row.get::<_, String>(7)?),
            })
        }
    );
    
    match result {
        Ok(info) => Ok(Some(info)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(AppError::Database(format!("Failed to get project: {}", e))),
    }
}
