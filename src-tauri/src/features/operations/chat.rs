//! Chat operations (commands + persistence).
//!
//! Compatible with original ops_chat.rs API.

use rusqlite::params;
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use std::path::Path;

use crate::infrastructure::database;
use crate::features::project::persistence as project_persistence;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub id: String,
    pub node_id: String,
    pub role: String,
    pub content: String,
    pub content_type: String,
    pub timestamp: i64,
    #[ts(optional)]
    pub attachments_json: Option<String>,
    #[ts(optional)]
    pub output_asset_id: Option<String>,
}

/// Get all chat messages for a node
#[tauri::command]
pub async fn get_chat_messages(
    project_path: String,
    node_id: String,
) -> Result<Vec<ChatMessage>, String> {
    let db_path = project_persistence::get_db_path(Path::new(&project_path));
    let conn = database::open_db(&db_path).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, node_id, role, content, content_type, timestamp, attachments_json, output_asset_id 
             FROM chat_messages 
             WHERE node_id = ? 
             ORDER BY timestamp ASC",
        )
        .map_err(|e| e.to_string())?;

    let messages = stmt
        .query_map(params![node_id], |row| {
            Ok(ChatMessage {
                id: row.get(0)?,
                node_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                content_type: row.get::<_, Option<String>>(4)?.unwrap_or_else(|| "text".to_string()),
                timestamp: row.get(5)?,
                attachments_json: row.get(6)?,
                output_asset_id: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(messages)
}

/// Add a new chat message
#[tauri::command]
pub async fn add_chat_message(
    project_path: String,
    message: ChatMessage,
) -> Result<(), String> {
    let db_path = project_persistence::get_db_path(Path::new(&project_path));
    let conn = database::open_db(&db_path).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO chat_messages (id, node_id, role, content, content_type, timestamp, attachments_json, output_asset_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            message.id,
            message.node_id,
            message.role,
            message.content,
            message.content_type,
            message.timestamp,
            message.attachments_json,
            message.output_asset_id,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Clear all chat messages for a node
#[tauri::command]
pub async fn clear_chat_messages(
    project_path: String,
    node_id: String,
) -> Result<(), String> {
    let db_path = project_persistence::get_db_path(Path::new(&project_path));
    let conn = database::open_db(&db_path).map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM chat_messages WHERE node_id = ?", params![node_id])
        .map_err(|e| e.to_string())?;

    Ok(())
}
