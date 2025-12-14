//! Asset management commands.

use tauri::{State, AppHandle};
use crate::error::AppError;
use crate::AppState;
use crate::services::{database, io_sqlite};
use std::path::PathBuf;
use std::io::Cursor;
use base64::Engine;
use image::ImageReader;

/// Info for a media asset (for library view)
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaAssetInfo {
    pub id: String,
    pub asset_type: String,
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
    
    println!("[Asset] Copying from {:?} to {:?}", source_path, target_path);
    std::fs::copy(&source_path, &target_path)?;

    // Check if it's an image and generate thumbnail
    let is_image = matches!(ext.to_lowercase().as_str(), "png" | "jpg" | "jpeg" | "gif" | "webp");
    
    if is_image {
        let image_data = std::fs::read(&target_path)?;
        let (width, height) = get_image_dimensions(&image_data)?;
        let thumbnail_path = generate_thumbnail(&project_root, &file_id, &image_data)?;
        
        Ok(SaveImageResult {
            relative_path,
            thumbnail_path: Some(thumbnail_path),
            width,
            height,
        })
    } else {
        Ok(SaveImageResult {
            relative_path,
            thumbnail_path: None,
            width: 0,
            height: 0,
        })
    }
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
    let final_filename = filename.unwrap_or_else(|| format!("{}.{}", file_id, ext));
    
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
    
    Ok(SaveImageResult {
        relative_path,
        thumbnail_path: Some(thumbnail_path),
        width,
        height,
    })
}

/// Get all media assets (images, videos, audio) for the asset library.
/// Excludes text and json types.
#[tauri::command]
pub fn get_media_assets(state: State<AppState>) -> Result<Vec<MediaAssetInfo>, AppError> {
    let project_path = {
        let path_guard = state.current_project_path.lock()
            .map_err(|_| AppError::Unknown("Path Lock Poisoned".to_string()))?;
        path_guard.clone().ok_or(AppError::ProjectNotLoaded)?
    };
    
    let project_root = PathBuf::from(&project_path);
    let db_path = io_sqlite::get_db_path(&project_root);
    
    let conn = database::open_db(&db_path)
        .map_err(|e| AppError::Io(format!("Failed to open database: {}", e)))?;
    
    // Query all assets that are not text or json
    let mut stmt = conn.prepare(
        "SELECT id, type, content_json, metadata_json, updated_at 
         FROM assets 
         WHERE type NOT IN ('text', 'json')
         ORDER BY updated_at DESC"
    ).map_err(|e| AppError::Io(format!("Failed to prepare query: {}", e)))?;
    
    let assets = stmt.query_map([], |row| {
        let id: String = row.get(0)?;
        let asset_type: String = row.get(1)?;
        let content_json: String = row.get(2)?;
        let metadata_json: String = row.get(3)?;
        let updated_at: i64 = row.get(4)?;
        Ok((id, asset_type, content_json, metadata_json, updated_at))
    }).map_err(|e| AppError::Io(format!("Failed to query assets: {}", e)))?;
    
    let mut result = Vec::new();
    
    for asset in assets {
        let (id, asset_type, content_json, metadata_json, updated_at) = 
            asset.map_err(|e| AppError::Io(format!("Failed to read asset: {}", e)))?;
        
        // Parse content (could be string path or object with src)
        let content: String = serde_json::from_str(&content_json)
            .unwrap_or_else(|_| content_json.trim_matches('"').to_string());
        
        // Parse metadata
        let metadata: serde_json::Value = serde_json::from_str(&metadata_json)
            .unwrap_or_else(|_| serde_json::json!({}));
        
        let name = metadata.get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("Unnamed")
            .to_string();
        
        let created_at = metadata.get("createdAt")
            .and_then(|v| v.as_i64())
            .unwrap_or(updated_at);
        
        let image_meta = metadata.get("image");
        let thumbnail_path = image_meta
            .and_then(|img| img.get("thumbnail"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        let width = image_meta
            .and_then(|img| img.get("width"))
            .and_then(|v| v.as_u64())
            .map(|v| v as u32);
        
        let height = image_meta
            .and_then(|img| img.get("height"))
            .and_then(|v| v.as_u64())
            .map(|v| v as u32);
        
        result.push(MediaAssetInfo {
            id,
            asset_type,
            name,
            content,
            thumbnail_path,
            width,
            height,
            created_at,
            updated_at,
        });
    }
    
    Ok(result)
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