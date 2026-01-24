//! History Tauri commands.

use tauri::State;
use std::path::PathBuf;

use crate::core::{AppError, AppState};
use crate::domain::Asset;
use crate::infrastructure::{database, hash};
use crate::features::project::persistence as project_persistence;
use super::persistence;

/// History entry for frontend
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: i64,
    pub asset_id: String,
    pub content_hash: String,
    pub content_preview: String,
    pub created_at: i64,
}

/// Save an asset and create a history snapshot if content changed.
/// Frontend calls this as "save_asset" for backward compatibility.
#[tauri::command(rename_all = "snake_case", rename = "save_asset")]
pub fn save_asset_with_history(
    asset: Asset,
    create_history: Option<bool>,
    state: State<AppState>,
) -> Result<bool, AppError> {
    let project_path = get_project_path(&state)?;
    let db_path = project_persistence::get_db_path(&project_path);
    
    let conn = database::open_db(&db_path)
        .map_err(|e| AppError::Database(format!("Failed to open database: {}", e)))?;
    
    let value_json = serde_json::to_string(&asset.value)?;
    let new_hash = hash::compute_content_hash(&value_json);
    
    let old_hash = persistence::get_current_hash(&conn, &asset.id)
        .map_err(|e| AppError::Database(format!("Failed to get current hash: {}", e)))?;
    
    let hash_changed = old_hash.as_ref() != Some(&new_hash);
    let should_create_history = create_history.unwrap_or(true);
    
    if hash_changed && should_create_history {
        if let Some(ref old) = old_hash {
            let old_value: Option<String> = conn.query_row(
                "SELECT value_json FROM assets WHERE id = ?1",
                rusqlite::params![&asset.id],
                |row| row.get(0),
            ).ok();
            
            if let Some(old_value) = old_value {
                persistence::create_snapshot_if_changed(&conn, &asset.id, old, &old_value)
                    .map_err(|e| AppError::Database(format!("Failed to create snapshot: {}", e)))?;
            }
        }
    }
    
    let sys_json = serde_json::to_string(&asset.sys)?;
    let value_meta_json = asset.value_meta.as_ref().map(|v| serde_json::to_string(v)).transpose()?;
    let config_json = asset.config.as_ref().map(|v| serde_json::to_string(v)).transpose()?;
    let now = chrono::Utc::now().timestamp_millis();
    let value_type_str = asset.value_type.as_str();
    
    conn.execute(
        "INSERT INTO assets (id, value_type, value_hash, value_json, value_meta_json, config_json, sys_json, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(id) DO UPDATE SET
             value_type = excluded.value_type,
             value_hash = excluded.value_hash,
             value_json = excluded.value_json,
             value_meta_json = excluded.value_meta_json,
             config_json = excluded.config_json,
             sys_json = excluded.sys_json,
             updated_at = excluded.updated_at",
        rusqlite::params![
            &asset.id,
            &value_type_str,
            &new_hash,
            &value_json,
            &value_meta_json,
            &config_json,
            &sys_json,
            now
        ],
    ).map_err(|e| AppError::Database(format!("Failed to save asset: {}", e)))?;
    
    Ok(hash_changed)
}

/// Get version history for an asset
#[tauri::command]
pub fn get_asset_history(
    asset_id: String,
    limit: Option<i32>,
    state: State<AppState>,
) -> Result<Vec<HistoryEntry>, AppError> {
    let project_path = get_project_path(&state)?;
    let db_path = project_persistence::get_db_path(&project_path);
    
    let conn = database::open_db(&db_path)
        .map_err(|e| AppError::Database(format!("Failed to open database: {}", e)))?;
    
    let mut result: Vec<HistoryEntry> = Vec::new();
    
    // First, get the current version from assets table
    let current: Option<(String, String, i64)> = conn.query_row(
        "SELECT value_hash, value_json, updated_at FROM assets WHERE id = ?1",
        rusqlite::params![&asset_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    ).ok();
    
    if let Some((hash_val, content, updated_at)) = current {
        result.push(HistoryEntry {
            id: 0,
            asset_id: asset_id.clone(),
            content_hash: hash_val,
            content_preview: truncate_content(&content, 100),
            created_at: updated_at,
        });
    }
    
    let history_limit = limit.map(|l| if l > 1 { l - 1 } else { l });
    let entries = persistence::get_asset_history(&conn, &asset_id, history_limit)
        .map_err(|e| AppError::Database(format!("Failed to get history: {}", e)))?;
    
    for e in entries {
        result.push(HistoryEntry {
            id: e.id,
            asset_id: e.asset_id,
            content_hash: e.content_hash,
            content_preview: truncate_content(&e.content_json, 100),
            created_at: e.created_at,
        });
    }
    
    Ok(result)
}

/// Get full content of a specific history version
#[tauri::command]
pub fn get_history_content(
    history_id: i64,
    state: State<AppState>,
) -> Result<String, AppError> {
    let project_path = get_project_path(&state)?;
    let db_path = project_persistence::get_db_path(&project_path);
    
    let conn = database::open_db(&db_path)
        .map_err(|e| AppError::Database(format!("Failed to open database: {}", e)))?;
    
    let entry = persistence::get_history_entry(&conn, history_id)
        .map_err(|e| AppError::Database(format!("Failed to get history entry: {}", e)))?
        .ok_or_else(|| AppError::NotFound("History entry not found".to_string()))?;
    
    Ok(entry.content_json)
}

/// Restore an asset to a specific history version
#[tauri::command]
pub fn restore_asset_version(
    asset_id: String,
    history_id: i64,
    state: State<AppState>,
) -> Result<serde_json::Value, AppError> {
    let project_path = get_project_path(&state)?;
    let db_path = project_persistence::get_db_path(&project_path);
    
    let conn = database::open_db(&db_path)
        .map_err(|e| AppError::Database(format!("Failed to open database: {}", e)))?;
    
    let entry = persistence::get_history_entry(&conn, history_id)
        .map_err(|e| AppError::Database(format!("Failed to get history entry: {}", e)))?
        .ok_or_else(|| AppError::NotFound("History entry not found".to_string()))?;
    
    if entry.asset_id != asset_id {
        return Err(AppError::Validation("History entry does not belong to this asset".to_string()));
    }
    
    let content: serde_json::Value = serde_json::from_str(&entry.content_json)?;
    
    let now = chrono::Utc::now().timestamp_millis();
    let new_hash = hash::compute_content_hash(&entry.content_json);
    
    conn.execute(
        "UPDATE assets SET value_json = ?1, value_hash = ?2, updated_at = ?3 WHERE id = ?4",
        rusqlite::params![&entry.content_json, &new_hash, now, &asset_id],
    ).map_err(|e| AppError::Database(format!("Failed to restore asset: {}", e)))?;
    
    Ok(content)
}

/// Count history entries for an asset
#[tauri::command]
pub fn count_asset_history(
    asset_id: String,
    state: State<AppState>,
) -> Result<i64, AppError> {
    let project_path = get_project_path(&state)?;
    let db_path = project_persistence::get_db_path(&project_path);
    
    let conn = database::open_db(&db_path)
        .map_err(|e| AppError::Database(format!("Failed to open database: {}", e)))?;
    
    persistence::count_history(&conn, &asset_id)
        .map_err(|e| AppError::Database(format!("Failed to count history: {}", e)))
}

// Helper functions

fn get_project_path(state: &State<AppState>) -> Result<PathBuf, AppError> {
    let path_guard = state.current_project_path.lock()
        .map_err(|_| AppError::Unknown("Lock poisoned".to_string()))?;
    
    path_guard
        .as_ref()
        .map(|p| PathBuf::from(p))
        .ok_or(AppError::ProjectNotLoaded)
}

fn truncate_content(content: &str, max_len: usize) -> String {
    if content.len() <= max_len {
        content.to_string()
    } else {
        let mut end = max_len;
        while end > 0 && !content.is_char_boundary(end) {
            end -= 1;
        }
        format!("{}...", &content[..end])
    }
}
