//! Image processing utilities for assets.

use std::path::PathBuf;
use std::io::Cursor;
use base64::Engine;
use image::ImageReader;

use crate::core::AppError;

/// Decode base64 image data, handling data URI prefix
pub fn decode_base64_image(data: &str) -> Result<Vec<u8>, AppError> {
    let base64_str = if data.contains(",") {
        data.split(",").nth(1).unwrap_or(data)
    } else {
        data
    };
    
    base64::engine::general_purpose::STANDARD
        .decode(base64_str)
        .map_err(|e| AppError::Unknown(format!("Failed to decode base64: {}", e)))
}

/// Get image dimensions from raw bytes
pub fn get_image_dimensions(data: &[u8]) -> Result<(u32, u32), AppError> {
    let reader = ImageReader::new(Cursor::new(data))
        .with_guessed_format()
        .map_err(|e| AppError::Unknown(format!("Failed to read image: {}", e)))?;
    
    let dimensions = reader.into_dimensions()
        .map_err(|e| AppError::Unknown(format!("Failed to get image dimensions: {}", e)))?;
    
    Ok(dimensions)
}

/// Detect image format from raw bytes
pub fn detect_image_format(data: &[u8]) -> Option<&'static str> {
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
pub fn generate_thumbnail(project_root: &PathBuf, file_id: &str, image_data: &[u8]) -> Result<String, AppError> {
    const THUMBNAIL_SIZE: u32 = 200;
    
    let img = image::load_from_memory(image_data)
        .map_err(|e| AppError::Unknown(format!("Failed to load image for thumbnail: {}", e)))?;
    
    let thumbnail = img.thumbnail(THUMBNAIL_SIZE, THUMBNAIL_SIZE);
    
    let thumb_filename = format!("thumb_{}.jpg", file_id);
    let thumb_relative = format!("assets/{}", thumb_filename);
    let thumb_path = project_root.join(&thumb_relative);
    
    thumbnail.save(&thumb_path)
        .map_err(|e| AppError::Unknown(format!("Failed to save thumbnail: {}", e)))?;
    
    Ok(thumb_relative)
}

/// Infer semantic media type from file path or extension
pub fn infer_media_type(path: &str) -> String {
    let ext = path.rsplit('.').next().unwrap_or("").to_lowercase();
    match ext.as_str() {
        "jpg" | "jpeg" | "png" | "gif" | "webp" | "bmp" | "svg" | "ico" => "image".to_string(),
        "mp4" | "webm" | "mov" | "avi" | "mkv" | "m4v" => "video".to_string(),
        "mp3" | "wav" | "ogg" | "m4a" | "flac" | "aac" => "audio".to_string(),
        "pdf" => "pdf".to_string(),
        _ => "file".to_string(),
    }
}
