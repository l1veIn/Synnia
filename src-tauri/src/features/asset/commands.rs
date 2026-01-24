//! Asset management Tauri commands.

use tauri::{State, AppHandle};
use rusqlite::params;
use std::path::PathBuf;
use std::collections::HashSet;

use crate::core::{AppError, AppState};
use crate::infrastructure::database;
use crate::features::project::persistence as project_persistence;
use super::types::*;
use super::image;
use super::persistence;

// ============================================
// File Import Commands
// ============================================

/// Import a file from the file system into the project assets folder.
#[tauri::command]
pub async fn import_file(
    file_path: String, 
    state: State<'_, AppState>, 
    _app: AppHandle
) -> Result<SaveImageResult, AppError> {
    let project_root = get_project_root(&state)?;
    let source_path_str = file_path.clone();
    
    let result = tokio::task::spawn_blocking(move || {
        let source_path = PathBuf::from(&source_path_str);
        if !source_path.exists() {
            return Err(AppError::NotFound(format!("File not found: {}", source_path_str)));
        }

        let assets_dir = project_root.join("assets");
        if !assets_dir.exists() {
            std::fs::create_dir_all(&assets_dir)?;
        }

        let ext = source_path.extension().and_then(|s| s.to_str()).unwrap_or("bin");
        let file_id = uuid::Uuid::new_v4().to_string();
        let new_filename = format!("{}.{}", file_id, ext);
        let relative_path = format!("assets/{}", new_filename);
        let target_path = project_root.join(&relative_path);
        
        let original_name = source_path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Imported")
            .to_string();
        
        std::fs::copy(&source_path, &target_path)?;

        let is_image = matches!(ext.to_lowercase().as_str(), "png" | "jpg" | "jpeg" | "gif" | "webp");
        
        let (width, height, thumbnail_path) = if is_image {
            let image_data = std::fs::read(&target_path)?;
            let (w, h) = image::get_image_dimensions(&image_data)?;
            let thumb = image::generate_thumbnail(&project_root, &file_id, &image_data)?;
            (w, h, Some(thumb))
        } else {
            (0, 0, None)
        };
        
        let db_path = project_persistence::get_db_path(&project_root);
        let conn = database::open_db(&db_path)
            .map_err(|e| AppError::Database(format!("Failed to open database: {}", e)))?;
        
        let asset_id = persistence::create_media_asset(
            &conn,
            &relative_path,
            &original_name,
            width,
            height,
            thumbnail_path.as_deref(),
        )?;
        
        Ok(SaveImageResult {
            asset_id,
            relative_path,
            thumbnail_path,
            width,
            height,
        })
    }).await.map_err(|e| AppError::Unknown(format!("Task panicked: {}", e)))??;
    
    Ok(result)
}

/// Save a processed image from base64 data.
#[tauri::command]
pub fn save_processed_image(
    base64_data: String,
    filename: Option<String>,
    state: State<AppState>,
) -> Result<SaveImageResult, AppError> {
    let project_root = get_project_root(&state)?;
    
    let image_data = image::decode_base64_image(&base64_data)?;
    let (width, height) = image::get_image_dimensions(&image_data)?;
    
    let file_id = uuid::Uuid::new_v4().to_string();
    let ext = image::detect_image_format(&image_data).unwrap_or("png");
    let final_filename = filename.clone().unwrap_or_else(|| format!("{}.{}", file_id, ext));
    let asset_name = filename.unwrap_or_else(|| "Processed Image".to_string());
    
    let assets_dir = project_root.join("assets");
    if !assets_dir.exists() {
        std::fs::create_dir_all(&assets_dir)?;
    }
    
    let relative_path = format!("assets/{}", final_filename);
    let target_path = project_root.join(&relative_path);
    std::fs::write(&target_path, &image_data)?;
    
    let thumbnail_path = image::generate_thumbnail(&project_root, &file_id, &image_data)?;
    
    let db_path = project_persistence::get_db_path(&project_root);
    let conn = database::open_db(&db_path)
        .map_err(|e| AppError::Database(format!("Failed to open database: {}", e)))?;
    
    let asset_id = persistence::create_media_asset(
        &conn,
        &relative_path,
        &asset_name,
        width,
        height,
        Some(&thumbnail_path),
    )?;
    
    Ok(SaveImageResult {
        asset_id,
        relative_path,
        thumbnail_path: Some(thumbnail_path),
        width,
        height,
    })
}

/// Download an image from a URL and save it to the assets folder.
#[tauri::command]
pub async fn download_and_save_image(
    url: String,
    filename: Option<String>,
    state: State<'_, AppState>,
) -> Result<SaveImageResult, AppError> {
    let project_root = get_project_root(&state)?;
    
    let client = reqwest::Client::new();
    let response = client.get(&url)
        .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
        .header("Referer", "https://gemini.google.com/")
        .header("Accept", "image/webp,image/apng,image/*,*/*;q=0.8")
        .send()
        .await
        .map_err(|e| AppError::Network(format!("Failed to download image: {}", e)))?;
    
    if !response.status().is_success() {
        return Err(AppError::Network(format!("HTTP error: {}", response.status())));
    }
    
    let image_data = response.bytes().await
        .map_err(|e| AppError::Network(format!("Failed to read response: {}", e)))?;
    
    let (width, height) = image::get_image_dimensions(&image_data)?;
    
    let file_id = uuid::Uuid::new_v4().to_string();
    let ext = image::detect_image_format(&image_data).unwrap_or("png");
    let final_filename = filename.clone().unwrap_or_else(|| format!("{}.{}", file_id, ext));
    let asset_name = filename.unwrap_or_else(|| "Downloaded Image".to_string());
    
    let assets_dir = project_root.join("assets");
    if !assets_dir.exists() {
        std::fs::create_dir_all(&assets_dir)?;
    }
    
    let relative_path = format!("assets/{}", final_filename);
    let target_path = project_root.join(&relative_path);
    std::fs::write(&target_path, &image_data)?;
    
    let thumbnail_path = image::generate_thumbnail(&project_root, &file_id, &image_data)?;
    
    let db_path = project_persistence::get_db_path(&project_root);
    let conn = database::open_db(&db_path)
        .map_err(|e| AppError::Database(format!("Failed to open database: {}", e)))?;
    
    let asset_id = persistence::create_media_asset(
        &conn,
        &relative_path,
        &asset_name,
        width,
        height,
        Some(&thumbnail_path),
    )?;
    
    Ok(SaveImageResult {
        asset_id,
        relative_path,
        thumbnail_path: Some(thumbnail_path),
        width,
        height,
    })
}

/// Import multiple files from the file system.
#[tauri::command]
pub fn batch_import_images(
    file_paths: Vec<String>,
    state: State<AppState>,
) -> Result<Vec<BatchImportResult>, AppError> {
    let project_root = get_project_root(&state)?;
    
    let assets_dir = project_root.join("assets");
    if !assets_dir.exists() {
        std::fs::create_dir_all(&assets_dir)?;
    }
    
    let db_path = project_persistence::get_db_path(&project_root);
    let conn = database::open_db(&db_path)
        .map_err(|e| AppError::Database(format!("Failed to open database: {}", e)))?;
    
    let mut results: Vec<BatchImportResult> = Vec::with_capacity(file_paths.len());
    
    for file_path in file_paths {
        let source_path = PathBuf::from(&file_path);
        
        if !source_path.exists() {
            results.push(BatchImportResult {
                source_path: file_path,
                result: None,
                error: Some("File not found".to_string()),
            });
            continue;
        }
        
        let ext = source_path.extension()
            .and_then(|s| s.to_str())
            .unwrap_or("bin")
            .to_lowercase();
        
        if !matches!(ext.as_str(), "png" | "jpg" | "jpeg" | "gif" | "webp" | "bmp") {
            results.push(BatchImportResult {
                source_path: file_path,
                result: None,
                error: Some(format!("Unsupported image format: {}", ext)),
            });
            continue;
        }
        
        let original_name = source_path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Imported")
            .to_string();
        
        let file_id = uuid::Uuid::new_v4().to_string();
        let new_filename = format!("{}.{}", file_id, ext);
        let relative_path = format!("assets/{}", new_filename);
        let target_path = project_root.join(&relative_path);
        
        match std::fs::copy(&source_path, &target_path) {
            Ok(_) => {
                match std::fs::read(&target_path) {
                    Ok(image_data) => {
                        let (width, height) = image::get_image_dimensions(&image_data).unwrap_or((0, 0));
                        let thumbnail_path = image::generate_thumbnail(&project_root, &file_id, &image_data).ok();
                        
                        match persistence::create_media_asset(
                            &conn,
                            &relative_path,
                            &original_name,
                            width,
                            height,
                            thumbnail_path.as_deref(),
                        ) {
                            Ok(asset_id) => {
                                results.push(BatchImportResult {
                                    source_path: file_path,
                                    result: Some(SaveImageResult {
                                        asset_id,
                                        relative_path,
                                        thumbnail_path,
                                        width,
                                        height,
                                    }),
                                    error: None,
                                });
                            }
                            Err(e) => {
                                results.push(BatchImportResult {
                                    source_path: file_path,
                                    result: None,
                                    error: Some(format!("Failed to create asset: {}", e)),
                                });
                            }
                        }
                    }
                    Err(e) => {
                        results.push(BatchImportResult {
                            source_path: file_path,
                            result: None,
                            error: Some(format!("Failed to read image: {}", e)),
                        });
                    }
                }
            }
            Err(e) => {
                results.push(BatchImportResult {
                    source_path: file_path,
                    result: None,
                    error: Some(format!("Failed to copy file: {}", e)),
                });
            }
        }
    }
    
    Ok(results)
}

// ============================================
// Query Commands
// ============================================

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

// ============================================
// Delete Commands
// ============================================

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
            let relative_path: Option<String> = serde_json::from_str(&value_json).ok();
            
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

// ============================================
// Helper Functions
// ============================================

fn get_project_root(state: &State<AppState>) -> Result<PathBuf, AppError> {
    let project_path_str = {
        let path_guard = state.current_project_path.lock()
            .map_err(|_| AppError::Unknown("Path Lock Poisoned".to_string()))?;
        path_guard.clone().ok_or(AppError::ProjectNotLoaded)?
    };
    
    let project_path = PathBuf::from(project_path_str);
    
    if project_path.extension().is_some() {
        Ok(project_path.parent().unwrap_or(&project_path).to_path_buf())
    } else {
        Ok(project_path)
    }
}

// Re-export OptionalExtension for query_row().optional()
use rusqlite::OptionalExtension;
