//! Asset types for API responses.

use serde::{Deserialize, Serialize};

/// Info for a media asset (for library view)
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaAssetInfo {
    pub id: String,
    pub media_type: String,
    pub name: String,
    pub content: String,
    pub thumbnail_path: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Response from save_image_file command
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveImageResult {
    pub asset_id: String,
    pub relative_path: String,
    pub thumbnail_path: Option<String>,
    pub width: u32,
    pub height: u32,
}

/// Parameters for get_media_assets query
#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GetMediaAssetsParams {
    pub ids: Option<Vec<String>>,
    pub media_type: Option<String>,
    pub search: Option<String>,
    pub sort_by: Option<String>,
    pub sort_order: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

/// Response from get_media_assets
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaAssetsResponse {
    pub items: Vec<MediaAssetInfo>,
    pub total: u32,
}

/// Result for a single file in batch import
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchImportResult {
    pub source_path: String,
    pub result: Option<SaveImageResult>,
    pub error: Option<String>,
}

/// Response from cleanup_orphan_assets
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupOrphansResult {
    pub deleted_count: u32,
    pub deleted_asset_ids: Vec<String>,
}

/// Unified response from import_resource command
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResourceResult {
    /// Asset ID in the database
    pub asset_id: String,
    /// Media type category: "image", "audio", "video", "document", "unknown"
    pub media_type: String,
    /// MIME type: "image/png", "audio/mp3", etc.
    pub mime_type: String,
    /// Relative path within the project (e.g., "assets/xxx.png")
    pub relative_path: String,
    /// Thumbnail path if generated
    pub thumbnail_path: Option<String>,
    /// Type-specific metadata (width/height for images, duration for audio/video, etc.)
    pub metadata: serde_json::Value,
}
