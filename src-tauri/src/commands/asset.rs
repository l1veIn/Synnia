//! Asset management commands.

use tauri::{State, AppHandle};
use rusqlite::{Connection, params};
use crate::error::AppError;
use crate::AppState;
use crate::services::{database, io_sqlite, hash};
use std::path::PathBuf;
use std::io::Cursor;
use base64::Engine;
use image::ImageReader;

/// Info for a media asset (for library view)
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaAssetInfo {
    pub id: String,
    pub media_type: String,  // Semantic type: image, video, audio, pdf, file
    pub name: String,
    pub content: String, // File path or URL
    pub thumbnail_path: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Response from save_image_file command
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveImageResult {
    /// The created Asset ID
    pub asset_id: String,
    /// Relative path to the saved image (e.g., "assets/xxx.png")
    pub relative_path: String,
    /// Relative path to the thumbnail (e.g., "assets/thumb_xxx.jpg")
    pub thumbnail_path: Option<String>,
    /// Image width
    pub width: u32,
    /// Image height
    pub height: u32,
}

/// Import a file from the file system into the project assets folder.
#[tauri::command]
pub fn import_file(file_path: String, state: State<AppState>, _app: AppHandle) -> Result<SaveImageResult, AppError> {
    let project_root = get_project_root(&state)?;
    
    let source_path = PathBuf::from(&file_path);
    if !source_path.exists() {
        return Err(AppError::NotFound(format!("File not found: {}", file_path)));
    }

    // Create assets directory if it doesn't exist
    let assets_dir = project_root.join("assets");
    if !assets_dir.exists() {
        std::fs::create_dir_all(&assets_dir)?;
    }

    let ext = source_path.extension().and_then(|s| s.to_str()).unwrap_or("bin");
    let file_id = uuid::Uuid::new_v4().to_string();
    let new_filename = format!("{}.{}", file_id, ext);
    let relative_path = format!("assets/{}", new_filename);
    let target_path = project_root.join(&relative_path);
    
    // Get original filename for asset name
    let original_name = source_path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Imported");
    
    println!("[Asset] Copying from {:?} to {:?}", source_path, target_path);
    std::fs::copy(&source_path, &target_path)?;

    // Check if it's an image and generate thumbnail
    let is_image = matches!(ext.to_lowercase().as_str(), "png" | "jpg" | "jpeg" | "gif" | "webp");
    
    let (width, height, thumbnail_path) = if is_image {
        let image_data = std::fs::read(&target_path)?;
        let (w, h) = get_image_dimensions(&image_data)?;
        let thumb = generate_thumbnail(&project_root, &file_id, &image_data)?;
        (w, h, Some(thumb))
    } else {
        (0, 0, None)
    };
    
    // Create Asset record in database
    let db_path = io_sqlite::get_db_path(&project_root);
    let conn = database::open_db(&db_path)
        .map_err(|e| AppError::Io(format!("Failed to open database: {}", e)))?;
    
    let asset_id = create_media_asset(
        &conn,
        &relative_path,
        original_name,
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
}

/// Save a processed image from base64 data.
/// This is called after image editing (crop, rotate, bg removal, etc.)
#[tauri::command]
pub fn save_processed_image(
    base64_data: String,
    filename: Option<String>,
    state: State<AppState>,
) -> Result<SaveImageResult, AppError> {
    let project_root = get_project_root(&state)?;
    
    // Decode base64
    let image_data = decode_base64_image(&base64_data)?;
    
    // Get image dimensions
    let (width, height) = get_image_dimensions(&image_data)?;
    
    // Generate unique filename
    let file_id = uuid::Uuid::new_v4().to_string();
    let ext = detect_image_format(&image_data).unwrap_or("png");
    let final_filename = filename.clone().unwrap_or_else(|| format!("{}.{}", file_id, ext));
    let asset_name = filename.unwrap_or_else(|| "Processed Image".to_string());
    
    // Ensure assets directory exists
    let assets_dir = project_root.join("assets");
    if !assets_dir.exists() {
        std::fs::create_dir_all(&assets_dir)?;
    }
    
    // Save the image
    let relative_path = format!("assets/{}", final_filename);
    let target_path = project_root.join(&relative_path);
    std::fs::write(&target_path, &image_data)?;
    
    // Generate thumbnail
    let thumbnail_path = generate_thumbnail(&project_root, &file_id, &image_data)?;
    
    // Create Asset record in database
    let db_path = io_sqlite::get_db_path(&project_root);
    let conn = database::open_db(&db_path)
        .map_err(|e| AppError::Io(format!("Failed to open database: {}", e)))?;
    
    let asset_id = create_media_asset(
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
/// This is used for AI-generated images that are returned as HTTP URLs.
#[tauri::command]
pub async fn download_and_save_image(
    url: String,
    filename: Option<String>,
    state: State<'_, AppState>,
) -> Result<SaveImageResult, AppError> {
    let project_root = get_project_root(&state)?;
    
    // Download the image with browser-like headers to avoid 403/429 errors
    // Google's image servers (lh3.googleusercontent.com) require proper headers
    let client = reqwest::Client::new();
    let response = client.get(&url)
        .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .header("Referer", "https://gemini.google.com/")
        .header("Accept", "image/webp,image/apng,image/*,*/*;q=0.8")
        .header("Accept-Language", "en-US,en;q=0.9")
        .send()
        .await
        .map_err(|e| AppError::Unknown(format!("Failed to download image: {}", e)))?;
    
    if !response.status().is_success() {
        return Err(AppError::Unknown(format!("HTTP error: {}", response.status())));
    }
    
    let image_data = response.bytes().await
        .map_err(|e| AppError::Unknown(format!("Failed to read response: {}", e)))?;
    
    // Get image dimensions
    let (width, height) = get_image_dimensions(&image_data)?;
    
    // Generate unique filename
    let file_id = uuid::Uuid::new_v4().to_string();
    let ext = detect_image_format(&image_data).unwrap_or("png");
    let final_filename = filename.clone().unwrap_or_else(|| format!("{}.{}", file_id, ext));
    let asset_name = filename.unwrap_or_else(|| "Downloaded Image".to_string());
    
    // Ensure assets directory exists
    let assets_dir = project_root.join("assets");
    if !assets_dir.exists() {
        std::fs::create_dir_all(&assets_dir)?;
    }
    
    // Save the image
    let relative_path = format!("assets/{}", final_filename);
    let target_path = project_root.join(&relative_path);
    std::fs::write(&target_path, &image_data)?;
    
    // Generate thumbnail
    let thumbnail_path = generate_thumbnail(&project_root, &file_id, &image_data)?;
    
    // Create Asset record in database
    let db_path = io_sqlite::get_db_path(&project_root);
    let conn = database::open_db(&db_path)
        .map_err(|e| AppError::Io(format!("Failed to open database: {}", e)))?;
    
    let asset_id = create_media_asset(
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

/// Parameters for get_media_assets query
#[derive(Debug, Clone, serde::Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GetMediaAssetsParams {
    /// Filter by specific asset IDs
    pub ids: Option<Vec<String>>,
    /// Filter by media type (image, video, audio)
    pub media_type: Option<String>,
    /// Search by name (case-insensitive contains)
    pub search: Option<String>,
    /// Sort field: createdAt, updatedAt, name
    pub sort_by: Option<String>,
    /// Sort order: asc, desc
    pub sort_order: Option<String>,
    /// Limit results
    pub limit: Option<u32>,
    /// Offset for pagination
    pub offset: Option<u32>,
}

/// Response from get_media_assets
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaAssetsResponse {
    pub items: Vec<MediaAssetInfo>,
    pub total: u32,
}

/// Get all media assets (images, videos, audio) for the asset library.
/// Only returns assets where sys.isLibraryAsset is true.
/// Supports filtering by IDs, media type, search, and pagination.
#[tauri::command]
pub fn get_media_assets(
    params: Option<GetMediaAssetsParams>,
    state: State<AppState>
) -> Result<MediaAssetsResponse, AppError> {
    let params = params.unwrap_or_default();
    
    let project_path = {
        let path_guard = state.current_project_path.lock()
            .map_err(|_| AppError::Unknown("Path Lock Poisoned".to_string()))?;
        path_guard.clone().ok_or(AppError::ProjectNotLoaded)?
    };
    
    let project_root = PathBuf::from(&project_path);
    let db_path = io_sqlite::get_db_path(&project_root);
    
    let conn = database::open_db(&db_path)
        .map_err(|e| AppError::Io(format!("Failed to open database: {}", e)))?;
    
    // Query all assets, filter by isLibraryAsset in code (since it's in JSON)
    let mut stmt = conn.prepare(
        "SELECT id, value_type, value_json, value_meta_json, config_json, sys_json, updated_at 
         FROM assets 
         ORDER BY updated_at DESC"
    ).map_err(|e| AppError::Io(format!("Failed to prepare query: {}", e)))?;
    
    let assets = stmt.query_map([], |row| {
        let id: String = row.get(0)?;
        let asset_type: String = row.get(1)?;
        let value_json: String = row.get(2)?;
        let value_meta_json: Option<String> = row.get(3)?;
        let config_json: Option<String> = row.get(4)?;
        let sys_json: String = row.get(5)?;
        let updated_at: i64 = row.get(6)?;
        Ok((id, asset_type, value_json, value_meta_json, config_json, sys_json, updated_at))
    }).map_err(|e| AppError::Io(format!("Failed to query assets: {}", e)))?;
    
    // Build ID set for filtering if provided
    let id_set: Option<std::collections::HashSet<String>> = params.ids.as_ref()
        .map(|ids| ids.iter().cloned().collect());
    
    let mut all_items = Vec::new();
    
    for asset in assets {
        let (id, _asset_type, value_json, value_meta_json, config_json, sys_json, updated_at) = 
            asset.map_err(|e| AppError::Io(format!("Failed to read asset: {}", e)))?;
        
        // Filter by ID list if provided
        if let Some(ref ids) = id_set {
            if !ids.contains(&id) {
                continue;
            }
        }
        
        // Parse sys metadata
        let sys: serde_json::Value = serde_json::from_str(&sys_json)
            .unwrap_or_else(|_| serde_json::json!({}));
        
        // Only include assets where isLibraryAsset is true
        let is_library_asset = sys.get("isLibraryAsset")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        
        if !is_library_asset {
            continue;
        }
        
        // Parse value (could be string path or object with src field)
        let value: serde_json::Value = serde_json::from_str(&value_json)
            .unwrap_or(serde_json::Value::Null);
        
        // Try to get image src from value.src (ImageNode format) or use raw value
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
        
        // Try to get image metadata from config.meta first, then fall back to value_meta
        let config: serde_json::Value = config_json
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_else(|| serde_json::json!({}));
        
        let config_meta = config.get("meta").cloned().unwrap_or_else(|| serde_json::json!({}));
        
        let value_meta: serde_json::Value = value_meta_json
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_else(|| serde_json::json!({}));
        
        // Prefer config.meta over value_meta
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
        
        // Infer media type from file extension
        let media_type = infer_media_type(&content);
        
        // Filter by media type if provided
        if let Some(ref filter_type) = params.media_type {
            if &media_type != filter_type {
                continue;
            }
        }
        
        // Filter by search term if provided (case-insensitive name search)
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
    
    // Sort items
    let sort_by = params.sort_by.as_deref().unwrap_or("updatedAt");
    let sort_desc = params.sort_order.as_deref() != Some("asc");
    
    all_items.sort_by(|a, b| {
        let cmp = match sort_by {
            "name" => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
            "createdAt" => a.created_at.cmp(&b.created_at),
            _ => a.updated_at.cmp(&b.updated_at), // default: updatedAt
        };
        if sort_desc { cmp.reverse() } else { cmp }
    });
    
    // Get total before pagination
    let total = all_items.len() as u32;
    
    // Apply pagination
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
// Helper Functions
// ============================================

/// Infer semantic media type from file path or extension
fn infer_media_type(path: &str) -> String {
    let ext = path.rsplit('.').next().unwrap_or("").to_lowercase();
    match ext.as_str() {
        "jpg" | "jpeg" | "png" | "gif" | "webp" | "bmp" | "svg" | "ico" => "image".to_string(),
        "mp4" | "webm" | "mov" | "avi" | "mkv" | "m4v" => "video".to_string(),
        "mp3" | "wav" | "ogg" | "m4a" | "flac" | "aac" => "audio".to_string(),
        "pdf" => "pdf".to_string(),
        _ => "file".to_string(),
    }
}

/// Create an Asset record for an imported media file.
/// This makes the file immediately visible in the Asset Library.
fn create_media_asset(
    conn: &Connection,
    relative_path: &str,
    original_name: &str,
    width: u32,
    height: u32,
    thumbnail_path: Option<&str>,
) -> Result<String, AppError> {
    let asset_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();
    
    // Value is just the relative path as a JSON string
    let value_json = serde_json::json!(relative_path).to_string();
    let value_hash = hash::compute_content_hash(&value_json);
    
    // Store metadata in config.meta
    let config_json = serde_json::json!({
        "meta": {
            "width": width,
            "height": height,
            "preview": thumbnail_path
        }
    }).to_string();
    
    // System metadata with isLibraryAsset = true
    let sys_json = serde_json::json!({
        "name": original_name,
        "createdAt": now,
        "updatedAt": now,
        "source": "import",
        "isLibraryAsset": true
    }).to_string();
    
    conn.execute(
        "INSERT INTO assets (id, value_type, value_hash, value_json, value_meta_json, config_json, sys_json, updated_at)
         VALUES (?1, ?2, ?3, ?4, NULL, ?5, ?6, ?7)",
        params![&asset_id, "\"record\"", &value_hash, &value_json, &config_json, &sys_json, now],
    ).map_err(|e| AppError::Io(format!("Failed to create asset: {}", e)))?;
    
    Ok(asset_id)
}

fn get_project_root(state: &State<AppState>) -> Result<PathBuf, AppError> {
    let project_path_str = {
        let path_guard = state.current_project_path.lock()
            .map_err(|_| AppError::Unknown("Path Lock Poisoned".to_string()))?;
        path_guard.clone().ok_or(AppError::ProjectNotLoaded)?
    };
    
    let project_path = PathBuf::from(project_path_str);
    
    // If project_path is a file (e.g. synnia.json), get its parent directory
    if project_path.extension().is_some() {
        Ok(project_path.parent().unwrap_or(&project_path).to_path_buf())
    } else {
        Ok(project_path)
    }
}

/// Decode base64 image data, handling data URI prefix
fn decode_base64_image(data: &str) -> Result<Vec<u8>, AppError> {
    let base64_str = if data.contains(",") {
        // Data URI format: "data:image/png;base64,xxxxx"
        data.split(",").nth(1).unwrap_or(data)
    } else {
        data
    };
    
    base64::engine::general_purpose::STANDARD
        .decode(base64_str)
        .map_err(|e| AppError::Unknown(format!("Failed to decode base64: {}", e)))
}

/// Get image dimensions from raw bytes
fn get_image_dimensions(data: &[u8]) -> Result<(u32, u32), AppError> {
    let reader = ImageReader::new(Cursor::new(data))
        .with_guessed_format()
        .map_err(|e| AppError::Unknown(format!("Failed to read image: {}", e)))?;
    
    let dimensions = reader.into_dimensions()
        .map_err(|e| AppError::Unknown(format!("Failed to get image dimensions: {}", e)))?;
    
    Ok(dimensions)
}

/// Detect image format from raw bytes
fn detect_image_format(data: &[u8]) -> Option<&'static str> {
    if data.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
        Some("png")
    } else if data.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some("jpg")
    } else if data.starts_with(b"GIF") {
        Some("gif")
    } else if data.starts_with(b"RIFF") && data.len() > 12 && &data[8..12] == b"WEBP" {
        Some("webp")
    } else {
        None
    }
}

/// Generate a thumbnail for an image
fn generate_thumbnail(project_root: &PathBuf, file_id: &str, image_data: &[u8]) -> Result<String, AppError> {
    const THUMBNAIL_SIZE: u32 = 200;
    
    let img = image::load_from_memory(image_data)
        .map_err(|e| AppError::Unknown(format!("Failed to load image for thumbnail: {}", e)))?;
    
    // Resize to thumbnail (preserving aspect ratio)
    let thumbnail = img.thumbnail(THUMBNAIL_SIZE, THUMBNAIL_SIZE);
    
    // Save thumbnail as JPEG (smaller file size)
    let thumb_filename = format!("thumb_{}.jpg", file_id);
    let thumb_relative = format!("assets/{}", thumb_filename);
    let thumb_path = project_root.join(&thumb_relative);
    
    thumbnail.save(&thumb_path)
        .map_err(|e| AppError::Unknown(format!("Failed to save thumbnail: {}", e)))?;
    
    Ok(thumb_relative)
}

/// Result for a single file in batch import
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchImportResult {
    /// Original file path
    pub source_path: String,
    /// Success result (if import succeeded)
    pub result: Option<SaveImageResult>,
    /// Error message (if import failed)
    pub error: Option<String>,
}

/// Import multiple files from the file system into the project assets folder.
/// Returns results for each file, including any errors.
#[tauri::command]
pub fn batch_import_images(
    file_paths: Vec<String>,
    state: State<AppState>,
) -> Result<Vec<BatchImportResult>, AppError> {
    let project_root = get_project_root(&state)?;
    
    // Create assets directory if it doesn't exist
    let assets_dir = project_root.join("assets");
    if !assets_dir.exists() {
        std::fs::create_dir_all(&assets_dir)?;
    }
    
    // Open database connection once for all imports
    let db_path = io_sqlite::get_db_path(&project_root);
    let conn = database::open_db(&db_path)
        .map_err(|e| AppError::Io(format!("Failed to open database: {}", e)))?;
    
    let mut results: Vec<BatchImportResult> = Vec::with_capacity(file_paths.len());
    
    for file_path in file_paths {
        let source_path = PathBuf::from(&file_path);
        
        // Check if file exists
        if !source_path.exists() {
            results.push(BatchImportResult {
                source_path: file_path,
                result: None,
                error: Some("File not found".to_string()),
            });
            continue;
        }
        
        // Get extension and generate new filename
        let ext = source_path.extension()
            .and_then(|s| s.to_str())
            .unwrap_or("bin")
            .to_lowercase();
        
        // Skip non-image files
        if !matches!(ext.as_str(), "png" | "jpg" | "jpeg" | "gif" | "webp" | "bmp") {
            results.push(BatchImportResult {
                source_path: file_path,
                result: None,
                error: Some(format!("Unsupported image format: {}", ext)),
            });
            continue;
        }
        
        // Get original filename for asset name
        let original_name = source_path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Imported")
            .to_string();
        
        let file_id = uuid::Uuid::new_v4().to_string();
        let new_filename = format!("{}.{}", file_id, ext);
        let relative_path = format!("assets/{}", new_filename);
        let target_path = project_root.join(&relative_path);
        
        // Copy file
        match std::fs::copy(&source_path, &target_path) {
            Ok(_) => {
                // Read image and generate thumbnail
                match std::fs::read(&target_path) {
                    Ok(image_data) => {
                        let (width, height) = get_image_dimensions(&image_data).unwrap_or((0, 0));
                        let thumbnail_path = generate_thumbnail(&project_root, &file_id, &image_data).ok();
                        
                        // Create Asset record
                        match create_media_asset(
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