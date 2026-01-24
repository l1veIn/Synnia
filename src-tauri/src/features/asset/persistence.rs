//! Asset persistence operations.

use rusqlite::{Connection, params};

use crate::core::AppError;
use crate::infrastructure::hash;

/// Create an Asset record for an imported media file.
pub fn create_media_asset(
    conn: &Connection,
    relative_path: &str,
    original_name: &str,
    width: u32,
    height: u32,
    thumbnail_path: Option<&str>,
) -> Result<String, AppError> {
    let asset_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();
    
    let value_json = serde_json::json!(relative_path).to_string();
    let value_hash = hash::compute_content_hash(&value_json);
    
    let config_json = serde_json::json!({
        "meta": {
            "width": width,
            "height": height,
            "preview": thumbnail_path
        }
    }).to_string();
    
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
    ).map_err(|e| AppError::Database(format!("Failed to create asset: {}", e)))?;
    
    Ok(asset_id)
}
