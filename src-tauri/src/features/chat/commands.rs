//! Chat persistence Tauri commands.
//!
//! All chat data is stored in the project-level SQLite database.

use std::path::PathBuf;
use tauri::State;

use super::session_repository::{self, SessionMessage};
use super::types::{ChatIndex, ThreadData, ThreadMetadata};
use crate::core::{AppError, AppState};
use crate::features::project::persistence as project_persistence;
use crate::infrastructure::database;

// ============================================================================
// Helper Functions
// ============================================================================

/// Get the project root from AppState.
fn get_project_root(state: &State<AppState>) -> Result<PathBuf, String> {
    let project_path = state
        .current_project_path
        .lock()
        .map_err(|e| format!("Failed to lock project path: {}", e))?;

    let project_dir = project_path
        .as_ref()
        .ok_or("No project is currently open")?;

    Ok(PathBuf::from(project_dir))
}

/// Convert milliseconds timestamp to ISO8601 string
fn iso_from_millis(millis: i64) -> String {
    use chrono::{DateTime, Utc};
    DateTime::<Utc>::from_timestamp_millis(millis)
        .map(|dt| dt.to_rfc3339())
        .unwrap_or_else(|| "1970-01-01T00:00:00Z".to_string())
}

// ============================================================================
// Index Operations (for ChatThreadListAdapter compatibility)
// ============================================================================

/// Get the chat index for the current project.
/// Reads from SQL and constructs ChatIndex for frontend compatibility.
#[tauri::command]
pub async fn chat_get_index(state: State<'_, AppState>) -> Result<ChatIndex, String> {
    let project_root = get_project_root(&state)?;
    let db_path = project_persistence::get_db_path(&project_root);
    
    let conn = database::open_db(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;
    
    let sessions = session_repository::list_sessions(&conn)
        .map_err(|e| format!("Failed to list sessions: {}", e))?;
    
    let threads: Vec<ThreadMetadata> = sessions.into_iter().map(|s| ThreadMetadata {
        id: s.id,
        title: s.title,
        created_at: iso_from_millis(s.created_at),
        updated_at: iso_from_millis(s.updated_at),
        is_archived: s.is_archived,
        message_count: 0,
        last_message: None,
        model_id: s.last_model_id,
    }).collect();
    
    Ok(ChatIndex {
        version: 1,
        threads,
    })
}

/// Save the chat index for the current project.
/// For SQL, this updates individual session metadata.
#[tauri::command]
pub async fn chat_save_index(state: State<'_, AppState>, index: ChatIndex) -> Result<(), String> {
    let project_root = get_project_root(&state)?;
    let db_path = project_persistence::get_db_path(&project_root);
    
    let conn = database::open_db(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;
    
    for meta in &index.threads {
        if session_repository::get_session(&conn, &meta.id)
            .map_err(|e| e.to_string())?
            .is_some() 
        {
            session_repository::update_session_title(&conn, &meta.id, &meta.title)
                .map_err(|e| e.to_string())?;
            session_repository::update_session_archived(&conn, &meta.id, meta.is_archived)
                .map_err(|e| e.to_string())?;
        } else {
            session_repository::create_session(&conn, &meta.id, &meta.title)
                .map_err(|e| e.to_string())?;
        }
    }
    
    Ok(())
}

// ============================================================================
// Thread Operations (for ThreadHistoryAdapter compatibility)
// ============================================================================

/// Get a single thread by ID.
/// Reads session + messages from SQL and constructs ThreadData.
#[tauri::command]
pub async fn chat_get_thread(
    state: State<'_, AppState>,
    thread_id: String,
) -> Result<Option<ThreadData>, String> {
    let project_root = get_project_root(&state)?;
    let db_path = project_persistence::get_db_path(&project_root);
    
    let conn = database::open_db(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;
    
    let session = match session_repository::get_session(&conn, &thread_id)
        .map_err(|e| e.to_string())? 
    {
        Some(s) => s,
        None => return Ok(None),
    };
    
    let messages = session_repository::get_messages(&conn, &thread_id)
        .map_err(|e| e.to_string())?;
    
    // Convert SessionMessage to frontend format (parse content_json)
    let parsed_messages: Vec<serde_json::Value> = messages
        .iter()
        .filter_map(|m| serde_json::from_str(&m.content_json).ok())
        .collect();
    
    Ok(Some(ThreadData {
        id: session.id,
        title: session.title,
        created_at: iso_from_millis(session.created_at),
        updated_at: iso_from_millis(session.updated_at),
        model_id: session.last_model_id,
        messages: parsed_messages,
        tool_confirmations: None,
    }))
}

/// Save a thread.
/// For SQL, this creates/updates session and appends any new messages.
#[tauri::command]
pub async fn chat_save_thread(state: State<'_, AppState>, thread: ThreadData) -> Result<(), String> {
    let project_root = get_project_root(&state)?;
    let db_path = project_persistence::get_db_path(&project_root);
    
    let conn = database::open_db(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;
    
    // Create or update session
    if session_repository::get_session(&conn, &thread.id)
        .map_err(|e| e.to_string())?
        .is_none() 
    {
        session_repository::create_session(&conn, &thread.id, &thread.title)
            .map_err(|e| e.to_string())?;
    } else {
        session_repository::update_session_title(&conn, &thread.id, &thread.title)
            .map_err(|e| e.to_string())?;
    }
    
    // Get existing message IDs to avoid duplicates
    let existing_messages = session_repository::get_messages(&conn, &thread.id)
        .map_err(|e| e.to_string())?;
    let existing_ids: std::collections::HashSet<String> = existing_messages
        .iter()
        .map(|m| m.id.clone())
        .collect();
    
    // Append only new messages
    for msg in &thread.messages {
        let msg_id = msg.get("id").and_then(|v| v.as_str()).unwrap_or("");
        if !msg_id.is_empty() && !existing_ids.contains(msg_id) {
            let role = msg.get("role").and_then(|v| v.as_str()).unwrap_or("user");
            let content_json = serde_json::to_string(&msg).unwrap_or_default();
            
            let session_message = SessionMessage {
                id: msg_id.to_string(),
                session_id: thread.id.clone(),
                role: role.to_string(),
                content_json,
                created_at: chrono::Utc::now().timestamp_millis(),
                model_id: thread.model_id.clone(),
                provider: None,
            };
            
            session_repository::append_message(&conn, &session_message)
                .map_err(|e| e.to_string())?;
        }
    }
    
    Ok(())
}

/// Delete a thread by ID.
#[tauri::command]
pub async fn chat_delete_thread(state: State<'_, AppState>, thread_id: String) -> Result<(), String> {
    let project_root = get_project_root(&state)?;
    let db_path = project_persistence::get_db_path(&project_root);
    
    let conn = database::open_db(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;
    
    session_repository::delete_session(&conn, &thread_id)
        .map_err(|e| e.to_string())
}
