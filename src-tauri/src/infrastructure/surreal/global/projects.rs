use serde::{Deserialize, Serialize};
use surrealdb::sql::Thing;
use std::path::Path;

use crate::core::AppError;
use crate::infrastructure::surreal::global::{map_db_error, Db};

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

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectRecord {
    id: Thing,
    name: String,
    path: String,
    thumbnail: Option<String>,
    last_opened: i64,
    created_at: i64,
    is_pinned: bool,
    status: String,
}

impl ProjectRecord {
    fn into_info(self) -> ProjectInfo {
        ProjectInfo {
            id: self.id.id.to_string(),
            name: self.name,
            path: self.path,
            thumbnail: self.thumbnail,
            last_opened: self.last_opened,
            created_at: self.created_at,
            is_pinned: self.is_pinned,
            status: ProjectStatus::from_str(&self.status),
        }
    }
}

pub async fn register_project(db: &Db, path: &str, name: &str) -> Result<String, AppError> {
    let now = chrono::Utc::now().timestamp_millis();

    if let Some(existing) = get_project_by_path(db, path).await? {
        let _: Option<ProjectRecord> = db
            .update(("projects", existing.id.as_str()))
            .content(ProjectRecord {
                id: Thing::from(("projects", existing.id.as_str())),
                name: name.to_string(),
                path: path.to_string(),
                thumbnail: existing.thumbnail.clone(),
                last_opened: now,
                created_at: existing.created_at,
                is_pinned: existing.is_pinned,
                status: ProjectStatus::Valid.as_str().to_string(),
            })
            .await
            .map_err(map_db_error)?;
        return Ok(existing.id);
    }

    let id = uuid::Uuid::new_v4().to_string();
    let record = ProjectRecord {
        id: Thing::from(("projects", id.as_str())),
        name: name.to_string(),
        path: path.to_string(),
        thumbnail: None,
        last_opened: now,
        created_at: now,
        is_pinned: false,
        status: ProjectStatus::Valid.as_str().to_string(),
    };

    let _: Option<ProjectRecord> = db
        .create(("projects", id.as_str()))
        .content(record)
        .await
        .map_err(map_db_error)?;

    Ok(id)
}

pub async fn list_projects(db: &Db, limit: Option<i32>) -> Result<Vec<ProjectInfo>, AppError> {
    let limit = limit.unwrap_or(50) as i64;
    let mut response = db
        .query("SELECT * FROM projects ORDER BY is_pinned DESC, last_opened DESC LIMIT $limit")
        .bind(("limit", limit))
        .await
        .map_err(map_db_error)?;

    let records: Vec<ProjectRecord> = response.take(0).map_err(map_db_error)?;
    Ok(records.into_iter().map(|r| r.into_info()).collect())
}

pub async fn get_project_by_path(db: &Db, path: &str) -> Result<Option<ProjectInfo>, AppError> {
    let mut response = db
        .query("SELECT * FROM projects WHERE path = $path")
        .bind(("path", path.to_string()))
        .await
        .map_err(map_db_error)?;

    let record: Option<ProjectRecord> = response.take(0).map_err(map_db_error)?;
    Ok(record.map(|r| r.into_info()))
}

pub async fn remove_project(db: &Db, path: &str) -> Result<bool, AppError> {
    let mut response = db
        .query("DELETE FROM projects WHERE path = $path")
        .bind(("path", path.to_string()))
        .await
        .map_err(map_db_error)?;

    let deleted: Vec<ProjectRecord> = response.take(0).map_err(map_db_error)?;
    Ok(!deleted.is_empty())
}

pub async fn update_thumbnail(db: &Db, path: &str, thumbnail: Option<&str>) -> Result<(), AppError> {
    if let Some(existing) = get_project_by_path(db, path).await? {
        let id = existing.id.clone();
        let record = ProjectRecord {
            id: Thing::from(("projects", id.as_str())),
            name: existing.name,
            path: existing.path,
            thumbnail: thumbnail.map(|s| s.to_string()),
            last_opened: existing.last_opened,
            created_at: existing.created_at,
            is_pinned: existing.is_pinned,
            status: existing.status.as_str().to_string(),
        };

        let _: Option<ProjectRecord> = db
            .update(("projects", id.as_str()))
            .content(record)
            .await
            .map_err(map_db_error)?;
    }
    Ok(())
}

pub async fn validate_projects(db: &Db) -> Result<ValidateResult, AppError> {
    let projects = list_projects(db, None).await?;
    let mut updated = 0;

    for project in projects {
        let path = Path::new(&project.path);
        let new_status = if path.exists() {
            ProjectStatus::Valid
        } else {
            ProjectStatus::Missing
        };

        if new_status != project.status {
            let id = project.id.clone();
            let record = ProjectRecord {
                id: Thing::from(("projects", id.as_str())),
                name: project.name,
                path: project.path,
                thumbnail: project.thumbnail,
                last_opened: project.last_opened,
                created_at: project.created_at,
                is_pinned: project.is_pinned,
                status: new_status.as_str().to_string(),
            };

            let _: Option<ProjectRecord> = db
                .update(("projects", id.as_str()))
                .content(record)
                .await
                .map_err(map_db_error)?;
            updated += 1;
        }
    }

    Ok(ValidateResult { updated })
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidateResult {
    pub updated: i32,
}
