//! Asset query commands.

use tauri::State;
use std::collections::HashSet;

use crate::core::{AppError, AppState};
use crate::infrastructure::database;
use crate::features::project::persistence as project_persistence;
use super::super::types::*;
use super::super::image;
use super::get_project_root;

/// Get all media assets for the asset library.
#[tauri::command]
pub fn get_media_assets(
    params: Option<GetMediaAssetsParams>,
    state: State<AppState>
) -> Result<MediaAssetsResponse, AppError> {
    let params = params.unwrap_or_default();
    
    let project_root = get_project_root(&state)?;
    let db_path = project_persistence::get_db_path(&project_root);
    
    let conn = database::open_db(&db_path)
        .map_err(|e| AppError::Database(format!("Failed to open database: {}", e)))?;
    
    let mut stmt = conn.prepare(
        "SELECT id, value_type, value_json, value_meta_json, config_json, sys_json, updated_at 
         FROM assets 
         ORDER BY updated_at DESC"
    ).map_err(|e| AppError::Database(format!("Failed to prepare query: {}", e)))?;
    
    let assets = stmt.query_map([], |row| {
        let id: String = row.get(0)?;
        let _asset_type: String = row.get(1)?;
        let value_json: String = row.get(2)?;
        let value_meta_json: Option<String> = row.get(3)?;
        let config_json: Option<String> = row.get(4)?;
        let sys_json: String = row.get(5)?;
        let updated_at: i64 = row.get(6)?;
        Ok((id, value_json, value_meta_json, config_json, sys_json, updated_at))
    }).map_err(|e| AppError::Database(format!("Failed to query assets: {}", e)))?;
    
    let id_set: Option<HashSet<String>> = params.ids.as_ref()
        .map(|ids| ids.iter().cloned().collect());
    
    let mut all_items = Vec::new();
    
    for asset in assets {
        let (id, value_json, value_meta_json, config_json, sys_json, updated_at) = 
            asset.map_err(|e| AppError::Database(format!("Failed to read asset: {}", e)))?;
        
        if let Some(ref ids) = id_set {
            if !ids.contains(&id) {
                continue;
            }
        }
        
        let sys: serde_json::Value = serde_json::from_str(&sys_json)
            .unwrap_or_else(|_| serde_json::json!({}));
        
        let is_library_asset = sys.get("isLibraryAsset")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        
        if !is_library_asset {
            continue;
        }
        
        let value: serde_json::Value = serde_json::from_str(&value_json)
            .unwrap_or(serde_json::Value::Null);
        
        let content: String = value.get("src")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .or_else(|| value.as_str().map(|s| s.to_string()))
            .unwrap_or_else(|| value_json.trim_matches('"').to_string());
        
        let name = sys.get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("Unnamed")
            .to_string();
        
        let created_at = sys.get("createdAt")
            .and_then(|v| v.as_i64())
            .unwrap_or(updated_at);
        
        let config: serde_json::Value = config_json
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_else(|| serde_json::json!({}));
        
        let config_meta = config.get("meta").cloned().unwrap_or_else(|| serde_json::json!({}));
        
        let value_meta: serde_json::Value = value_meta_json
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_else(|| serde_json::json!({}));
        
        let thumbnail_path = config_meta.get("preview")
            .or_else(|| value_meta.get("preview"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        let width = config_meta.get("width")
            .or_else(|| value_meta.get("width"))
            .and_then(|v| v.as_u64())
            .map(|v| v as u32);
        
        let height = config_meta.get("height")
            .or_else(|| value_meta.get("height"))
            .and_then(|v| v.as_u64())
            .map(|v| v as u32);
        
        let media_type = image::infer_media_type(&content);
        
        if let Some(ref filter_type) = params.media_type {
            if &media_type != filter_type {
                continue;
            }
        }
        
        if let Some(ref search) = params.search {
            if !search.is_empty() && !name.to_lowercase().contains(&search.to_lowercase()) {
                continue;
            }
        }
        
        all_items.push(MediaAssetInfo {
            id,
            media_type,
            name,
            content,
            thumbnail_path,
            width,
            height,
            created_at,
            updated_at,
        });
    }
    
    let sort_by = params.sort_by.as_deref().unwrap_or("updatedAt");
    let sort_desc = params.sort_order.as_deref() != Some("asc");
    
    all_items.sort_by(|a, b| {
        let cmp = match sort_by {
            "name" => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
            "createdAt" => a.created_at.cmp(&b.created_at),
            _ => a.updated_at.cmp(&b.updated_at),
        };
        if sort_desc { cmp.reverse() } else { cmp }
    });
    
    let total = all_items.len() as u32;
    
    let offset = params.offset.unwrap_or(0) as usize;
    let limit = params.limit.map(|l| l as usize);
    
    let items: Vec<MediaAssetInfo> = if let Some(limit) = limit {
        all_items.into_iter().skip(offset).take(limit).collect()
    } else {
        all_items.into_iter().skip(offset).collect()
    };
    
    Ok(MediaAssetsResponse { items, total })
}
