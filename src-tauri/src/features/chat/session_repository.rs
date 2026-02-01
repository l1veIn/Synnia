//! Session repository - CRUD operations for chat sessions in project database.
//!
//! This module handles persistence of independent chat sessions
//! (not Recipe node chats) using the project-level SQLite database.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

// ============================================================================
// Types
// ============================================================================

/// Session info for list display
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub id: String,
    pub title: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub is_archived: bool,
    pub last_model_id: Option<String>,
    pub last_provider: Option<String>,
}

/// A message stored in a session
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionMessage {
    pub id: String,
    pub session_id: String,
    pub role: String,
    /// JSON-serialized content (assistant-ui format)
    pub content_json: String,
    pub created_at: i64,
    pub model_id: Option<String>,
    pub provider: Option<String>,
}

// ============================================================================
// Session CRUD
// ============================================================================

/// Create a new chat session.
pub fn create_session(conn: &Connection, id: &str, title: &str) -> Result<(), rusqlite::Error> {
    let now = chrono::Utc::now().timestamp_millis();
    conn.execute(
        "INSERT INTO chat_sessions (id, title, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
        params![id, title, now, now],
    )?;
    Ok(())
}

/// Get all sessions ordered by most recently updated.
pub fn list_sessions(conn: &Connection) -> Result<Vec<SessionInfo>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, title, created_at, updated_at, is_archived, last_model_id, last_provider 
         FROM chat_sessions 
         ORDER BY updated_at DESC"
    )?;
    
    let sessions = stmt.query_map([], |row| {
        Ok(SessionInfo {
            id: row.get(0)?,
            title: row.get(1)?,
            created_at: row.get(2)?,
            updated_at: row.get(3)?,
            is_archived: row.get::<_, i32>(4)? != 0,
            last_model_id: row.get(5)?,
            last_provider: row.get(6)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    
    Ok(sessions)
}

/// Get a specific session by ID.
pub fn get_session(conn: &Connection, id: &str) -> Result<Option<SessionInfo>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, title, created_at, updated_at, is_archived, last_model_id, last_provider 
         FROM chat_sessions WHERE id = ?1"
    )?;
    
    let mut rows = stmt.query(params![id])?;
    match rows.next()? {
        Some(row) => Ok(Some(SessionInfo {
            id: row.get(0)?,
            title: row.get(1)?,
            created_at: row.get(2)?,
            updated_at: row.get(3)?,
            is_archived: row.get::<_, i32>(4)? != 0,
            last_model_id: row.get(5)?,
            last_provider: row.get(6)?,
        })),
        None => Ok(None),
    }
}

/// Update a session's title.
pub fn update_session_title(conn: &Connection, id: &str, title: &str) -> Result<(), rusqlite::Error> {
    let now = chrono::Utc::now().timestamp_millis();
    conn.execute(
        "UPDATE chat_sessions SET title = ?1, updated_at = ?2 WHERE id = ?3",
        params![title, now, id],
    )?;
    Ok(())
}

/// Archive/unarchive a session.
pub fn update_session_archived(conn: &Connection, id: &str, is_archived: bool) -> Result<(), rusqlite::Error> {
    let now = chrono::Utc::now().timestamp_millis();
    conn.execute(
        "UPDATE chat_sessions SET is_archived = ?1, updated_at = ?2 WHERE id = ?3",
        params![is_archived as i32, now, id],
    )?;
    Ok(())
}

/// Delete a session (messages are deleted via CASCADE).
pub fn delete_session(conn: &Connection, id: &str) -> Result<(), rusqlite::Error> {
    conn.execute("DELETE FROM chat_sessions WHERE id = ?1", params![id])?;
    Ok(())
}

// ============================================================================
// Message CRUD
// ============================================================================

/// Append a message to a session.
pub fn append_message(conn: &Connection, message: &SessionMessage) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT INTO session_messages (id, session_id, role, content_json, created_at, model_id, provider) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            message.id,
            message.session_id,
            message.role,
            message.content_json,
            message.created_at,
            message.model_id,
            message.provider,
        ],
    )?;
    
    // Update session's updated_at
    let now = chrono::Utc::now().timestamp_millis();
    conn.execute(
        "UPDATE chat_sessions SET updated_at = ?1 WHERE id = ?2",
        params![now, message.session_id],
    )?;
    
    Ok(())
}

/// Get all messages for a session in chronological order.
pub fn get_messages(conn: &Connection, session_id: &str) -> Result<Vec<SessionMessage>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, session_id, role, content_json, created_at, model_id, provider 
         FROM session_messages 
         WHERE session_id = ?1 
         ORDER BY created_at ASC"
    )?;
    
    let messages = stmt.query_map(params![session_id], |row| {
        Ok(SessionMessage {
            id: row.get(0)?,
            session_id: row.get(1)?,
            role: row.get(2)?,
            content_json: row.get(3)?,
            created_at: row.get(4)?,
            model_id: row.get(5)?,
            provider: row.get(6)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    
    Ok(messages)
}

/// Count messages in a session.
pub fn count_messages(conn: &Connection, session_id: &str) -> Result<i64, rusqlite::Error> {
    conn.query_row(
        "SELECT COUNT(*) FROM session_messages WHERE session_id = ?1",
        params![session_id],
        |row| row.get(0),
    )
}
