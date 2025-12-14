//! SQLite-based project I/O operations.
//!
//! This module provides SQLite-based implementations of project save/load/init.
//! Replaces the JSON-based io.rs for the new storage architecture.

use std::path::Path;
use std::collections::HashMap;
use rusqlite::{Connection, params, Result as SqliteResult};
use crate::models::{
    SynniaProject, ProjectMeta, Viewport, Graph, 
    SynniaNode, SynniaEdge, SynniaNodeData, Position, Asset, AssetMetadata
};
use crate::error::AppError;
use crate::services::database;
use crate::services::hash::compute_content_hash;
use crate::services::history;

/// Database filename
const DB_FILENAME: &str = "synnia.db";

/// Get the database path for a project.
pub fn get_db_path(project_root: &Path) -> std::path::PathBuf {
    project_root.join(DB_FILENAME)
}

/// Check if a project uses the new SQLite format.
pub fn is_sqlite_project(project_root: &Path) -> bool {
    get_db_path(project_root).exists()
}

/// Initialize a new project with SQLite storage.
pub fn init_project_sqlite(project_root: &Path, name: &str) -> Result<SynniaProject, AppError> {
    let db_path = get_db_path(project_root);
    
    // If DB already exists, load it instead
    if db_path.exists() {
        return load_project_sqlite(project_root);
    }
    
    // Create project directory if needed
    if !project_root.exists() {
        std::fs::create_dir_all(project_root)?;
    }
    
    // Create assets directory
    let assets_dir = project_root.join("assets");
    if !assets_dir.exists() {
        std::fs::create_dir_all(&assets_dir)?;
    }
    
    // Initialize database
    let conn = database::init_db(&db_path)
        .map_err(|e| AppError::Io(format!("Failed to init database: {}", e)))?;
    
    let now = chrono::Utc::now();
    let now_str = now.to_rfc3339();
    let now_ts = now.timestamp_millis();
    let project_id = uuid::Uuid::new_v4().to_string();
    
    // Insert project metadata
    conn.execute(
        "INSERT INTO project_meta (id, name, description, author, thumbnail, created_at, updated_at)
         VALUES (?1, ?2, NULL, NULL, NULL, ?3, ?3)",
        params![&project_id, name, now_ts],
    ).map_err(|e| AppError::Io(format!("Failed to insert project meta: {}", e)))?;
    
    // Build and return the project
    let project = SynniaProject {
        version: "3.0.0".to_string(), // New version for SQLite format
        meta: ProjectMeta {
            id: project_id,
            name: name.to_string(),
            created_at: now_str.clone(),
            updated_at: now_str,
            thumbnail: None,
            description: None,
            author: None,
        },
        viewport: Viewport { x: 0.0, y: 0.0, zoom: 1.0 },
        graph: Graph { nodes: vec![], edges: vec![] },
        assets: HashMap::new(),
        settings: None,
    };
    
    Ok(project)
}

/// Load a project from SQLite storage.
pub fn load_project_sqlite(project_root: &Path) -> Result<SynniaProject, AppError> {
    let db_path = get_db_path(project_root);
    
    if !db_path.exists() {
        return Err(AppError::NotFound("Project database not found".to_string()));
    }
    
    let conn = database::open_db(&db_path)
        .map_err(|e| AppError::Io(format!("Failed to open database: {}", e)))?;
    
    // Load project metadata
    let meta = load_project_meta(&conn)?;
    
    // Load viewport
    let viewport = load_viewport(&conn)?;
    
    // Load nodes
    let nodes = load_nodes(&conn)?;
    
    // Load edges
    let edges = load_edges(&conn)?;
    
    // Load assets
    let assets = load_assets(&conn)?;
    
    // Load settings
    let settings = load_settings(&conn)?;
    
    let project = SynniaProject {
        version: "3.0.0".to_string(),
        meta,
        viewport,
        graph: Graph { nodes, edges },
        assets,
        settings,
    };
    
    Ok(project)
}

/// Save a project to SQLite storage.
pub fn save_project_sqlite(project_root: &Path, project: &SynniaProject) -> Result<(), AppError> {
    let db_path = get_db_path(project_root);
    
    let conn = if db_path.exists() {
        database::open_db(&db_path)
    } else {
        database::init_db(&db_path)
    }.map_err(|e| AppError::Io(format!("Failed to open database: {}", e)))?;
    
    // Use a transaction for atomicity
    conn.execute("BEGIN TRANSACTION", [])
        .map_err(|e| AppError::Io(format!("Failed to begin transaction: {}", e)))?;
    
    let result = (|| {
        save_project_meta(&conn, &project.meta)?;
        save_viewport(&conn, &project.viewport)?;
        save_nodes(&conn, &project.graph.nodes)?;
        save_edges(&conn, &project.graph.edges)?;
        save_assets(&conn, &project.assets)?;
        save_settings(&conn, &project.settings)?;
        Ok::<(), AppError>(())
    })();
    
    match result {
        Ok(()) => {
            conn.execute("COMMIT", [])
                .map_err(|e| AppError::Io(format!("Failed to commit: {}", e)))?;
            Ok(())
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            Err(e)
        }
    }
}

/// Save a single asset with version history.
pub fn save_asset_with_history(
    project_root: &Path,
    asset: &Asset,
) -> Result<bool, AppError> {
    let db_path = get_db_path(project_root);
    let conn = database::open_db(&db_path)
        .map_err(|e| AppError::Io(format!("Failed to open database: {}", e)))?;
    
    let content_json = serde_json::to_string(&asset.content)?;
    let new_hash = compute_content_hash(&content_json);
    
    // Check if hash changed
    let old_hash = history::get_current_hash(&conn, &asset.id)
        .map_err(|e| AppError::Io(format!("Failed to get current hash: {}", e)))?;
    
    let hash_changed = old_hash.as_ref() != Some(&new_hash);
    
    // Create snapshot if hash changed
    if hash_changed {
        if let Some(old) = old_hash {
            // Get old content for snapshot
            let old_content: Option<String> = conn.query_row(
                "SELECT content_json FROM assets WHERE id = ?1",
                params![&asset.id],
                |row| row.get(0),
            ).ok();
            
            if let Some(old_content) = old_content {
                history::create_snapshot_if_changed(&conn, &asset.id, &old, &old_content)
                    .map_err(|e| AppError::Io(format!("Failed to create snapshot: {}", e)))?;
            }
        }
    }
    
    // Upsert asset
    let metadata_json = serde_json::to_string(&asset.metadata)?;
    let now = chrono::Utc::now().timestamp_millis();
    
    conn.execute(
        "INSERT INTO assets (id, type, content_hash, content_json, metadata_json, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(id) DO UPDATE SET
             type = excluded.type,
             content_hash = excluded.content_hash,
             content_json = excluded.content_json,
             metadata_json = excluded.metadata_json,
             updated_at = excluded.updated_at",
        params![
            &asset.id,
            &asset.type_,
            &new_hash,
            &content_json,
            &metadata_json,
            now
        ],
    ).map_err(|e| AppError::Io(format!("Failed to save asset: {}", e)))?;
    
    Ok(hash_changed)
}

// ============================================
// Private helper functions
// ============================================

fn load_project_meta(conn: &Connection) -> Result<ProjectMeta, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, description, author, thumbnail, created_at, updated_at 
         FROM project_meta LIMIT 1"
    ).map_err(|e| AppError::Io(format!("Failed to prepare query: {}", e)))?;
    
    let meta = stmt.query_row([], |row| {
        let created_ts: i64 = row.get(5)?;
        let updated_ts: i64 = row.get(6)?;
        
        Ok(ProjectMeta {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            author: row.get(3)?,
            thumbnail: row.get(4)?,
            created_at: chrono::DateTime::from_timestamp_millis(created_ts)
                .map(|dt| dt.to_rfc3339())
                .unwrap_or_default(),
            updated_at: chrono::DateTime::from_timestamp_millis(updated_ts)
                .map(|dt| dt.to_rfc3339())
                .unwrap_or_default(),
        })
    }).map_err(|e| AppError::NotFound(format!("Project metadata not found: {}", e)))?;
    
    Ok(meta)
}

fn save_project_meta(conn: &Connection, meta: &ProjectMeta) -> Result<(), AppError> {
    let now = chrono::Utc::now().timestamp_millis();
    
    // Parse created_at from string to timestamp
    let created_ts = chrono::DateTime::parse_from_rfc3339(&meta.created_at)
        .map(|dt| dt.timestamp_millis())
        .unwrap_or(now);
    
    conn.execute(
        "INSERT INTO project_meta (id, name, description, author, thumbnail, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             description = excluded.description,
             author = excluded.author,
             thumbnail = excluded.thumbnail,
             updated_at = excluded.updated_at",
        params![
            &meta.id,
            &meta.name,
            &meta.description,
            &meta.author,
            &meta.thumbnail,
            created_ts,
            now
        ],
    ).map_err(|e| AppError::Io(format!("Failed to save project meta: {}", e)))?;
    
    Ok(())
}

fn load_viewport(conn: &Connection) -> Result<Viewport, AppError> {
    conn.query_row(
        "SELECT x, y, zoom FROM viewport WHERE id = 1",
        [],
        |row| Ok(Viewport {
            x: row.get(0)?,
            y: row.get(1)?,
            zoom: row.get(2)?,
        }),
    ).map_err(|e| AppError::Io(format!("Failed to load viewport: {}", e)))
}

fn save_viewport(conn: &Connection, viewport: &Viewport) -> Result<(), AppError> {
    conn.execute(
        "UPDATE viewport SET x = ?1, y = ?2, zoom = ?3 WHERE id = 1",
        params![viewport.x, viewport.y, viewport.zoom],
    ).map_err(|e| AppError::Io(format!("Failed to save viewport: {}", e)))?;
    
    Ok(())
}

fn load_nodes(conn: &Connection) -> Result<Vec<SynniaNode>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, type, x, y, width, height, parent_id, extent, style_json, data_json FROM nodes"
    ).map_err(|e| AppError::Io(format!("Failed to prepare query: {}", e)))?;
    
    let nodes = stmt.query_map([], |row| {
        let style_json: Option<String> = row.get(8)?;
        let data_json: String = row.get(9)?;
        
        let style = style_json
            .and_then(|s| serde_json::from_str(&s).ok());
        let data: SynniaNodeData = serde_json::from_str(&data_json)
            .unwrap_or_else(|_| SynniaNodeData {
                title: "Untitled".to_string(),
                asset_id: None,
                is_reference: None,
                collapsed: None,
                layout_mode: None,
                docked_to: None,
                state: None,
                recipe_id: None,
            });
        
        Ok(SynniaNode {
            id: row.get(0)?,
            type_: row.get(1)?,
            position: Position { x: row.get(2)?, y: row.get(3)? },
            width: row.get(4)?,
            height: row.get(5)?,
            parent_id: row.get(6)?,
            extent: row.get(7)?,
            style,
            data,
        })
    }).map_err(|e| AppError::Io(format!("Failed to query nodes: {}", e)))?;
    
    nodes.collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Io(format!("Failed to load nodes: {}", e)))
}

fn save_nodes(conn: &Connection, nodes: &[SynniaNode]) -> Result<(), AppError> {
    // Clear existing nodes
    conn.execute("DELETE FROM nodes", [])
        .map_err(|e| AppError::Io(format!("Failed to clear nodes: {}", e)))?;
    
    // Insert new nodes
    for node in nodes {
        let style_json = node.style.as_ref()
            .and_then(|s| serde_json::to_string(s).ok());
        let data_json = serde_json::to_string(&node.data)?;
        
        conn.execute(
            "INSERT INTO nodes (id, type, x, y, width, height, parent_id, extent, style_json, data_json)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                &node.id,
                &node.type_,
                node.position.x,
                node.position.y,
                node.width,
                node.height,
                &node.parent_id,
                &node.extent,
                &style_json,
                &data_json
            ],
        ).map_err(|e| AppError::Io(format!("Failed to insert node: {}", e)))?;
    }
    
    Ok(())
}

fn load_edges(conn: &Connection) -> Result<Vec<SynniaEdge>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, source, target, source_handle, target_handle, type, label, animated FROM edges"
    ).map_err(|e| AppError::Io(format!("Failed to prepare query: {}", e)))?;
    
    let edges = stmt.query_map([], |row| {
        let animated: Option<i32> = row.get(7)?;
        
        Ok(SynniaEdge {
            id: row.get(0)?,
            source: row.get(1)?,
            target: row.get(2)?,
            source_handle: row.get(3)?,
            target_handle: row.get(4)?,
            type_: row.get(5)?,
            label: row.get(6)?,
            animated: animated.map(|a| a != 0),
        })
    }).map_err(|e| AppError::Io(format!("Failed to query edges: {}", e)))?;
    
    edges.collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Io(format!("Failed to load edges: {}", e)))
}

fn save_edges(conn: &Connection, edges: &[SynniaEdge]) -> Result<(), AppError> {
    conn.execute("DELETE FROM edges", [])
        .map_err(|e| AppError::Io(format!("Failed to clear edges: {}", e)))?;
    
    for edge in edges {
        let animated = edge.animated.map(|a| if a { 1 } else { 0 });
        
        conn.execute(
            "INSERT INTO edges (id, source, target, source_handle, target_handle, type, label, animated)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                &edge.id,
                &edge.source,
                &edge.target,
                &edge.source_handle,
                &edge.target_handle,
                &edge.type_,
                &edge.label,
                animated
            ],
        ).map_err(|e| AppError::Io(format!("Failed to insert edge: {}", e)))?;
    }
    
    Ok(())
}

fn load_assets(conn: &Connection) -> Result<HashMap<String, Asset>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, type, content_json, metadata_json FROM assets"
    ).map_err(|e| AppError::Io(format!("Failed to prepare query: {}", e)))?;
    
    let mut assets = HashMap::new();
    
    let rows = stmt.query_map([], |row| {
        let id: String = row.get(0)?;
        let type_: String = row.get(1)?;
        let content_json: String = row.get(2)?;
        let metadata_json: String = row.get(3)?;
        
        let content: serde_json::Value = serde_json::from_str(&content_json)
            .unwrap_or(serde_json::Value::Null);
        let metadata: AssetMetadata = serde_json::from_str(&metadata_json)
            .unwrap_or_else(|_| AssetMetadata {
                name: "Unknown".to_string(),
                created_at: 0,
                updated_at: 0,
                source: None,
                image: None,
                text: None,
                extra: HashMap::new(),
            });
        
        Ok(Asset { id, type_, content, metadata })
    }).map_err(|e| AppError::Io(format!("Failed to query assets: {}", e)))?;
    
    for asset_result in rows {
        let asset = asset_result.map_err(|e| AppError::Io(format!("Failed to load asset: {}", e)))?;
        assets.insert(asset.id.clone(), asset);
    }
    
    Ok(assets)
}

fn save_assets(conn: &Connection, assets: &HashMap<String, Asset>) -> Result<(), AppError> {
    // Note: We don't clear assets here to preserve history.
    // Instead, we upsert each asset.
    
    for (id, asset) in assets {
        let content_json = serde_json::to_string(&asset.content)?;
        let metadata_json = serde_json::to_string(&asset.metadata)?;
        let content_hash = compute_content_hash(&content_json);
        let now = chrono::Utc::now().timestamp_millis();
        
        conn.execute(
            "INSERT INTO assets (id, type, content_hash, content_json, metadata_json, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(id) DO UPDATE SET
                 type = excluded.type,
                 content_hash = excluded.content_hash,
                 content_json = excluded.content_json,
                 metadata_json = excluded.metadata_json,
                 updated_at = excluded.updated_at",
            params![id, &asset.type_, &content_hash, &content_json, &metadata_json, now],
        ).map_err(|e| AppError::Io(format!("Failed to save asset: {}", e)))?;
    }
    
    // Remove assets that are no longer in the project
    let ids: Vec<String> = assets.keys().cloned().collect();
    if !ids.is_empty() {
        let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!("DELETE FROM assets WHERE id NOT IN ({})", placeholders);
        
        let mut stmt = conn.prepare(&sql)
            .map_err(|e| AppError::Io(format!("Failed to prepare delete: {}", e)))?;
        
        for (i, id) in ids.iter().enumerate() {
            stmt.raw_bind_parameter(i + 1, id)
                .map_err(|e| AppError::Io(format!("Failed to bind: {}", e)))?;
        }
        
        stmt.raw_execute()
            .map_err(|e| AppError::Io(format!("Failed to delete orphaned assets: {}", e)))?;
    }
    
    Ok(())
}

fn load_settings(conn: &Connection) -> Result<Option<HashMap<String, serde_json::Value>>, AppError> {
    let mut stmt = conn.prepare("SELECT key, value_json FROM settings")
        .map_err(|e| AppError::Io(format!("Failed to prepare query: {}", e)))?;
    
    let rows = stmt.query_map([], |row| {
        let key: String = row.get(0)?;
        let value_json: String = row.get(1)?;
        let value: serde_json::Value = serde_json::from_str(&value_json)
            .unwrap_or(serde_json::Value::Null);
        Ok((key, value))
    }).map_err(|e| AppError::Io(format!("Failed to query settings: {}", e)))?;
    
    let mut settings = HashMap::new();
    for row_result in rows {
        let (key, value) = row_result.map_err(|e| AppError::Io(format!("Failed to load setting: {}", e)))?;
        settings.insert(key, value);
    }
    
    if settings.is_empty() {
        Ok(None)
    } else {
        Ok(Some(settings))
    }
}

fn save_settings(conn: &Connection, settings: &Option<HashMap<String, serde_json::Value>>) -> Result<(), AppError> {
    conn.execute("DELETE FROM settings", [])
        .map_err(|e| AppError::Io(format!("Failed to clear settings: {}", e)))?;
    
    if let Some(settings) = settings {
        for (key, value) in settings {
            let value_json = serde_json::to_string(value)?;
            conn.execute(
                "INSERT INTO settings (key, value_json) VALUES (?1, ?2)",
                params![key, &value_json],
            ).map_err(|e| AppError::Io(format!("Failed to save setting: {}", e)))?;
        }
    }
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_init_and_load_project() {
        let dir = tempdir().unwrap();
        let project_root = dir.path();
        
        // Init
        let project = init_project_sqlite(project_root, "Test Project").unwrap();
        assert_eq!(project.meta.name, "Test Project");
        assert_eq!(project.version, "3.0.0");
        
        // Load
        let loaded = load_project_sqlite(project_root).unwrap();
        assert_eq!(loaded.meta.name, "Test Project");
    }

    #[test]
    fn test_save_and_load_with_data() {
        let dir = tempdir().unwrap();
        let project_root = dir.path();
        
        let mut project = init_project_sqlite(project_root, "Test Project").unwrap();
        
        // Add some data
        project.graph.nodes.push(SynniaNode {
            id: "node-1".to_string(),
            type_: "text".to_string(),
            position: Position { x: 100.0, y: 200.0 },
            width: Some(300.0),
            height: Some(150.0),
            parent_id: None,
            extent: None,
            style: None,
            data: SynniaNodeData {
                title: "Hello".to_string(),
                asset_id: Some("asset-1".to_string()),
                is_reference: None,
                collapsed: None,
                layout_mode: None,
                docked_to: None,
                state: None,
                recipe_id: None,
            },
        });
        
        project.assets.insert("asset-1".to_string(), Asset {
            id: "asset-1".to_string(),
            type_: "text".to_string(),
            content: serde_json::json!({"text": "Hello World"}),
            metadata: AssetMetadata {
                name: "Text Asset".to_string(),
                created_at: 12345,
                updated_at: 12345,
                source: Some("user".to_string()),
                image: None,
                text: None,
                extra: HashMap::new(),
            },
        });
        
        // Save
        save_project_sqlite(project_root, &project).unwrap();
        
        // Load and verify
        let loaded = load_project_sqlite(project_root).unwrap();
        assert_eq!(loaded.graph.nodes.len(), 1);
        assert_eq!(loaded.graph.nodes[0].id, "node-1");
        assert_eq!(loaded.assets.len(), 1);
        assert!(loaded.assets.contains_key("asset-1"));
    }
}
