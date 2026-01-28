//! Asset import commands.

use tauri::State;
use std::path::PathBuf;
use base64::Engine;

use crate::core::{AppError, AppState};
use crate::infrastructure::database;
use crate::features::project::persistence as project_persistence;
use super::super::types::*;
use super::super::image;
use super::super::persistence;
use super::get_project_root;

/// Unified resource import command.
/// Accepts:
/// - File path (e.g., "/path/to/image.png")
/// - Base64 data URL (e.g., "data:image/png;base64,...")
/// - HTTP/HTTPS URL (e.g., "https://example.com/image.png")
#[tauri::command]
pub async fn import_resource(
    source: String,
    name: Option<String>,
    state: State<'_, AppState>,
) -> Result<ImportResourceResult, AppError> {
    let project_root = get_project_root(&state)?;
    
    // Handle HTTP/HTTPS URLs - download first (async)
    let (effective_source, effective_name) = if source.starts_with("http://") || source.starts_with("https://") {
        let client = reqwest::Client::new();
        let response = client.get(&source)
            .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
            .header("Referer", "https://gemini.google.com/")
            .header("Accept", "image/webp,image/apng,image/*,*/*;q=0.8")
            .send()
            .await
            .map_err(|e| AppError::Network(format!("Failed to download: {}", e)))?;
        
        if !response.status().is_success() {
            return Err(AppError::Network(format!("HTTP error: {}", response.status())));
        }
        
        let bytes = response.bytes().await
            .map_err(|e| AppError::Network(format!("Failed to read response: {}", e)))?;
        
        // Detect format and encode as data URL for import_resource_inner
        let ext = image::detect_image_format(&bytes).unwrap_or("bin");
        let mime = match ext {
            "png" => "image/png",
            "jpg" | "jpeg" => "image/jpeg",
            "gif" => "image/gif",
            "webp" => "image/webp",
            _ => "application/octet-stream",
        };
        let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
        let data_url = format!("data:{};base64,{}", mime, b64);
        
        let url_name = name.clone().or_else(|| {
            source.rsplit('/').next().map(|s| s.to_string())
        });
        
        (data_url, url_name)
    } else {
        (source, name)
    };
    
    let result = tokio::task::spawn_blocking(move || {
        import_resource_inner(&effective_source, effective_name.as_deref(), &project_root)
    }).await.map_err(|e| AppError::Unknown(format!("Task panicked: {}", e)))??;
    
    Ok(result)
}

/// Inner function for import_resource to run in blocking context
fn import_resource_inner(
    source: &str,
    name: Option<&str>,
    project_root: &PathBuf,
) -> Result<ImportResourceResult, AppError> {
    let assets_dir = project_root.join("assets");
    if !assets_dir.exists() {
        std::fs::create_dir_all(&assets_dir)?;
    }
    
    let file_id = uuid::Uuid::new_v4().to_string();
    
    // Determine if source is a file path or base64 data
    let (file_data, ext, original_name) = if source.starts_with("data:") {
        // Base64 data URL
        let data = image::decode_base64_image(source)?;
        let detected_ext = image::detect_image_format(&data).unwrap_or("bin");
        let filename = name.unwrap_or("Imported");
        (data, detected_ext.to_string(), filename.to_string())
    } else {
        // File path
        let source_path = PathBuf::from(source);
        if !source_path.exists() {
            return Err(AppError::NotFound(format!("File not found: {}", source)));
        }
        let data = std::fs::read(&source_path)?;
        let ext = source_path.extension()
            .and_then(|e| e.to_str())
            .unwrap_or("bin")
            .to_string();
        let filename = name.map(|n| n.to_string())
            .or_else(|| source_path.file_name()
                .and_then(|n| n.to_str())
                .map(|s| s.to_string()))
            .unwrap_or_else(|| "Imported".to_string());
        (data, ext, filename)
    };
    
    // Determine media type from extension
    let media_type = image::infer_media_type(&format!(".{}", ext));
    let mime_type = match ext.to_lowercase().as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "pdf" => "application/pdf",
        _ => "application/octet-stream",
    }.to_string();
    
    // Save file to assets
    let new_filename = format!("{}.{}", file_id, ext);
    let relative_path = format!("assets/{}", new_filename);
    let target_path = project_root.join(&relative_path);
    std::fs::write(&target_path, &file_data)?;
    
    // Process based on media type
    let (thumbnail_path, metadata) = match media_type.as_str() {
        "image" => {
            let (width, height) = image::get_image_dimensions(&file_data)?;
            let thumb = image::generate_thumbnail(project_root, &file_id, &file_data)?;
            (
                Some(thumb),
                serde_json::json!({ "width": width, "height": height })
            )
        }
        // TODO: Add audio/video processing in future phases
        _ => (None, serde_json::json!({}))
    };
    
    // Create asset in database
    let db_path = project_persistence::get_db_path(project_root);
    let conn = database::open_db(&db_path)
        .map_err(|e| AppError::Database(format!("Failed to open database: {}", e)))?;
    
    let (width, height) = match media_type.as_str() {
        "image" => (
            metadata.get("width").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
            metadata.get("height").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
        ),
        _ => (0, 0),
    };
    
    let asset_id = persistence::create_media_asset(
        &conn,
        &relative_path,
        &original_name,
        width,
        height,
        thumbnail_path.as_deref(),
    )?;
    
    Ok(ImportResourceResult {
        asset_id,
        media_type,
        mime_type,
        relative_path,
        thumbnail_path,
        metadata,
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
