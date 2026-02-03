//! Asset delete commands.

use tauri::State;
use rusqlite::params;
use std::collections::HashSet;

use crate::core::{AppError, AppState};
use crate::infrastructure::database;
use crate::features::project::persistence as project_persistence;
use super::super::types::CleanupOrphansResult;
use super::get_project_root;

// Re-export OptionalExtension for query_row().optional()
use rusqlite::OptionalExtension;

/// Delete a media asset from the database and optionally delete the physical files.
#[tauri::command]
pub fn delete_media_asset(
    asset_id: String,
    delete_files: Option<bool>,
    state: State<AppState>
) -> Result<(), AppError> {
    let project_root = get_project_root(&state)?;
    let db_path = project_persistence::get_db_path(&project_root);
    
    let conn = database::open_db(&db_path)
        .map_err(|e| AppError::Database(format!("Failed to open database: {}", e)))?;
    
    let asset_info: Option<(String, Option<String>)> = conn.query_row(
        "SELECT value_json, config_json FROM assets WHERE id = ?1",
        params![&asset_id],
        |row| {
            let value_json: String = row.get(0)?;
            let config_json: Option<String> = row.get(1)?;
            Ok((value_json, config_json))
        }
    ).optional().map_err(|e| AppError::Database(format!("Failed to query asset: {}", e)))?;
    
    if asset_info.is_none() {
        return Err(AppError::NotFound(format!("Asset not found: {}", asset_id)));
    }
    
    conn.execute(
        "DELETE FROM assets WHERE id = ?1",
        params![&asset_id],
    ).map_err(|e| AppError::Database(format!("Failed to delete asset: {}", e)))?;
    
    conn.execute(
        "DELETE FROM asset_history WHERE asset_id = ?1",
        params![&asset_id],
    ).ok();
    
    if delete_files.unwrap_or(true) {
        if let Some((value_json, config_json)) = asset_info {
            // Handle both { src: "path" } and "path" formats
            let relative_path: Option<String> = serde_json::from_str::<serde_json::Value>(&value_json)
                .ok()
                .and_then(|v| {
                    v.get("src").and_then(|s| s.as_str().map(|s| s.to_string()))
                        .or_else(|| v.as_str().map(|s| s.to_string()))
                });
            
            if let Some(path) = relative_path {
                let file_path = project_root.join(&path);
                if file_path.exists() {
                    let _ = std::fs::remove_file(&file_path);
                }
            }
            
            if let Some(config_str) = config_json {
                if let Ok(config) = serde_json::from_str::<serde_json::Value>(&config_str) {
                    if let Some(preview) = config.get("meta").and_then(|m| m.get("preview")).and_then(|p| p.as_str()) {
                        let thumb_path = project_root.join(preview);
                        if thumb_path.exists() {
                            let _ = std::fs::remove_file(&thumb_path);
                        }
                    }
                }
            }
        }
    }
    
    Ok(())
}

/// Delete orphan media assets that are not referenced by any node.
#[tauri::command]
pub fn cleanup_orphan_assets(
    state: State<AppState>
) -> Result<CleanupOrphansResult, AppError> {
    let project_root = get_project_root(&state)?;
    let db_path = project_persistence::get_db_path(&project_root);
    
    let conn = database::open_db(&db_path)
        .map_err(|e| AppError::Database(format!("Failed to open database: {}", e)))?;
    
    let mut referenced_ids: HashSet<String> = HashSet::new();
    
    // Scan nodes for asset references
    let mut node_stmt = conn.prepare("SELECT data_json FROM nodes")
        .map_err(|e| AppError::Database(format!("Failed to prepare query: {}", e)))?;
    
    let node_rows = node_stmt.query_map([], |row| {
        let data_json: String = row.get(0)?;
        Ok(data_json)
    }).map_err(|e| AppError::Database(format!("Failed to query nodes: {}", e)))?;
    
    for row in node_rows {
        if let Ok(data_json) = row {
            if let Ok(data) = serde_json::from_str::<serde_json::Value>(&data_json) {
                if let Some(asset_id) = data.get("assetId").and_then(|v| v.as_str()) {
                    referenced_ids.insert(asset_id.to_string());
                }
            }
        }
    }
    
    // Scan assets for mediaAssetId references (Gallery items)
    let mut asset_stmt = conn.prepare("SELECT value_json FROM assets")
        .map_err(|e| AppError::Database(format!("Failed to prepare query: {}", e)))?;
    
    let asset_rows = asset_stmt.query_map([], |row| {
        let value_json: String = row.get(0)?;
        Ok(value_json)
    }).map_err(|e| AppError::Database(format!("Failed to query assets: {}", e)))?;
    
    for row in asset_rows {
        if let Ok(value_json) = row {
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(&value_json) {
                if let Some(arr) = value.as_array() {
                    for item in arr {
                        if let Some(media_id) = item.get("mediaAssetId").and_then(|v| v.as_str()) {
                            referenced_ids.insert(media_id.to_string());
                        }
                    }
                }
            }
        }
    }
    
    // Find orphan library assets
    let mut orphan_stmt = conn.prepare(
        "SELECT id, value_json, config_json, sys_json FROM assets"
    ).map_err(|e| AppError::Database(format!("Failed to prepare query: {}", e)))?;
    
    let mut orphans_to_delete: Vec<(String, Option<String>, Option<String>)> = Vec::new();
    
    let orphan_rows = orphan_stmt.query_map([], |row| {
        let id: String = row.get(0)?;
        let value_json: String = row.get(1)?;
        let config_json: Option<String> = row.get(2)?;
        let sys_json: String = row.get(3)?;
        Ok((id, value_json, config_json, sys_json))
    }).map_err(|e| AppError::Database(format!("Failed to query assets: {}", e)))?;
    
    for row in orphan_rows {
        if let Ok((id, value_json, config_json, sys_json)) = row {
            if let Ok(sys) = serde_json::from_str::<serde_json::Value>(&sys_json) {
                let is_library = sys.get("isLibraryAsset")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);
                
                if is_library && !referenced_ids.contains(&id) {
                    orphans_to_delete.push((id, Some(value_json), config_json));
                }
            }
        }
    }
    
    // Delete orphans
    let mut deleted_ids: Vec<String> = Vec::new();
    
    for (asset_id, value_json, config_json) in orphans_to_delete {
        if conn.execute("DELETE FROM assets WHERE id = ?1", params![&asset_id]).is_ok() {
            let _ = conn.execute("DELETE FROM asset_history WHERE asset_id = ?1", params![&asset_id]);
            
            if let Some(value_str) = value_json {
                if let Ok(value) = serde_json::from_str::<serde_json::Value>(&value_str) {
                    let path = value.get("src").and_then(|v| v.as_str())
                        .or_else(|| value.as_str());
                    
                    if let Some(p) = path {
                        let file_path = project_root.join(p);
                        let _ = std::fs::remove_file(&file_path);
                    }
                }
                
                if let Some(config_str) = config_json {
                    if let Ok(config) = serde_json::from_str::<serde_json::Value>(&config_str) {
                        if let Some(preview) = config.get("meta").and_then(|m| m.get("preview")).and_then(|p| p.as_str()) {
                            let thumb_path = project_root.join(preview);
                            let _ = std::fs::remove_file(&thumb_path);
                        }
                    }
                }
            }
            
            deleted_ids.push(asset_id);
        }
    }
    
    Ok(CleanupOrphansResult {
        deleted_count: deleted_ids.len() as u32,
        deleted_asset_ids: deleted_ids,
    })
}
