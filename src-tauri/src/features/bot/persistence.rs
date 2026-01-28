//! Bot persistence layer.
//!
//! File-based persistence for bot chat history.
//! Stores conversations in {project}/.synnia/chat/{timestamp}.json

use std::path::{Path, PathBuf};
use std::fs;
use serde::{Deserialize, Serialize};

use super::commands::{BotMessage, BotMessageRole};

/// Chat history directory name (inside .synnia)
const CHAT_DIR_NAME: &str = ".synnia/chat";

/// File extension for chat history files
const CHAT_FILE_EXT: &str = "json";

/// Bot chat history session stored on disk
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BotHistorySession {
    pub id: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub messages: Vec<BotMessage>,
}

/// Bot session metadata (for listing sessions)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BotSessionMeta {
    pub id: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub message_count: usize,
}

/// Get the chat directory for a project
pub fn get_chat_dir(project_root: &Path) -> PathBuf {
    project_root.join(CHAT_DIR_NAME)
}

/// Get the path to a specific chat history file
pub fn get_chat_file_path(project_root: &Path, session_id: &str) -> PathBuf {
    get_chat_dir(project_root).join(format!("{}.{}", session_id, CHAT_FILE_EXT))
}

/// Ensure the chat directory exists
pub fn ensure_chat_dir(project_root: &Path) -> Result<(), std::io::Error> {
    let chat_dir = get_chat_dir(project_root);
    if !chat_dir.exists() {
        fs::create_dir_all(&chat_dir)?;
    }
    Ok(())
}

/// Save chat history to disk
pub fn save_chat_history(
    project_root: &Path,
    session_id: &str,
    messages: &[BotMessage],
) -> Result<(), String> {
    ensure_chat_dir(project_root)
        .map_err(|e| format!("Failed to create chat directory: {}", e))?;

    let session = BotHistorySession {
        id: session_id.to_string(),
        created_at: messages
            .first()
            .map(|m| m.timestamp)
            .unwrap_or_else(|| chrono::Utc::now().timestamp_millis()),
        updated_at: chrono::Utc::now().timestamp_millis(),
        messages: messages.to_vec(),
    };

    let json = serde_json::to_string_pretty(&session)
        .map_err(|e| format!("Failed to serialize chat history: {}", e))?;

    let file_path = get_chat_file_path(project_root, session_id);
    fs::write(&file_path, json)
        .map_err(|e| format!("Failed to write chat history: {}", e))?;

    Ok(())
}

/// Load chat history from disk
pub fn load_chat_history(
    project_root: &Path,
    session_id: &str,
) -> Result<BotHistorySession, String> {
    let file_path = get_chat_file_path(project_root, session_id);

    if !file_path.exists() {
        return Err(format!("Chat history file not found: {:?}", file_path));
    }

    let json = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read chat history: {}", e))?;

    let session: BotHistorySession = serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse chat history: {}", e))?;

    Ok(session)
}

/// Load the most recent chat history
pub fn load_recent_chat_history(project_root: &Path) -> Result<Option<BotHistorySession>, String> {
    let chat_dir = get_chat_dir(project_root);

    if !chat_dir.exists() {
        return Ok(None);
    }

    let entries = fs::read_dir(&chat_dir)
        .map_err(|e| format!("Failed to read chat directory: {}", e))?;

    let mut sessions: Vec<BotHistorySession> = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }

        let json = fs::read_to_string(&path);
        if json.is_err() {
            continue;
        }

        let session_result: Result<BotHistorySession, _> = serde_json::from_str(&json.unwrap());
        if let Ok(s) = session_result {
            sessions.push(s);
        }
    }

    // Sort by updated_at descending
    sessions.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));

    Ok(sessions.into_iter().next())
}

/// List all chat sessions
pub fn list_chat_sessions(project_root: &Path) -> Result<Vec<BotSessionMeta>, String> {
    let chat_dir = get_chat_dir(project_root);

    if !chat_dir.exists() {
        return Ok(Vec::new());
    }

    let entries = fs::read_dir(&chat_dir)
        .map_err(|e| format!("Failed to read chat directory: {}", e))?;

    let mut sessions: Vec<BotSessionMeta> = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }

        let json = fs::read_to_string(&path);
        if json.is_err() {
            continue;
        }

        let session_result: Result<BotHistorySession, _> = serde_json::from_str(&json.unwrap());
        if let Ok(s) = session_result {
            sessions.push(BotSessionMeta {
                id: s.id,
                created_at: s.created_at,
                updated_at: s.updated_at,
                message_count: s.messages.len(),
            });
        }
    }

    // Sort by updated_at descending
    sessions.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));

    Ok(sessions)
}

/// Delete a chat session
pub fn delete_chat_session(project_root: &Path, session_id: &str) -> Result<(), String> {
    let file_path = get_chat_file_path(project_root, session_id);

    if !file_path.exists() {
        return Err(format!("Chat history file not found: {:?}", file_path));
    }

    fs::remove_file(&file_path)
        .map_err(|e| format!("Failed to delete chat history: {}", e))?;

    Ok(())
}

// ============================================
// Tests
// ============================================

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_save_and_load_chat_history() {
        let dir = tempdir().unwrap();
        let project_root = dir.path();

        let messages = vec![
            BotMessage {
                id: "msg1".to_string(),
                role: BotMessageRole::User,
                content: "Hello".to_string(),
                timestamp: 1000,
                tool_calls: None,
                metadata: None,
            },
            BotMessage {
                id: "msg2".to_string(),
                role: BotMessageRole::Assistant,
                content: "Hi there!".to_string(),
                timestamp: 2000,
                tool_calls: None,
                metadata: None,
            },
        ];

        let session_id = "test_session";
        save_chat_history(project_root, session_id, &messages).unwrap();

        let loaded = load_chat_history(project_root, session_id).unwrap();
        assert_eq!(loaded.id, session_id);
        assert_eq!(loaded.messages.len(), 2);
        assert_eq!(loaded.messages[0].content, "Hello");
        assert_eq!(loaded.messages[1].content, "Hi there!");
    }

    #[test]
    fn test_load_recent_chat_history() {
        let dir = tempdir().unwrap();
        let project_root = dir.path();

        let messages1 = vec![BotMessage {
            id: "msg1".to_string(),
            role: BotMessageRole::User,
            content: "First".to_string(),
            timestamp: 1000,
            tool_calls: None,
            metadata: None,
        }];

        let messages2 = vec![BotMessage {
            id: "msg2".to_string(),
            role: BotMessageRole::User,
            content: "Second".to_string(),
            timestamp: 5000,
            tool_calls: None,
            metadata: None,
        }];

        save_chat_history(project_root, "session1", &messages1).unwrap();
        save_chat_history(project_root, "session2", &messages2).unwrap();

        let recent = load_recent_chat_history(project_root).unwrap();
        assert!(recent.is_some());
        assert_eq!(recent.unwrap().id, "session2"); // Most recent
    }

    #[test]
    fn test_list_chat_sessions() {
        let dir = tempdir().unwrap();
        let project_root = dir.path();

        let messages = vec![BotMessage {
            id: "msg1".to_string(),
            role: BotMessageRole::User,
            content: "Test".to_string(),
            timestamp: 1000,
            tool_calls: None,
            metadata: None,
        }];

        save_chat_history(project_root, "session1", &messages).unwrap();
        save_chat_history(project_root, "session2", &messages).unwrap();

        let sessions = list_chat_sessions(project_root).unwrap();
        assert_eq!(sessions.len(), 2);
    }

    #[test]
    fn test_delete_chat_session() {
        let dir = tempdir().unwrap();
        let project_root = dir.path();

        let messages = vec![BotMessage {
            id: "msg1".to_string(),
            role: BotMessageRole::User,
            content: "Test".to_string(),
            timestamp: 1000,
            tool_calls: None,
            metadata: None,
        }];

        save_chat_history(project_root, "session1", &messages).unwrap();

        // Verify it exists
        assert!(load_chat_history(project_root, "session1").is_ok());

        // Delete it
        delete_chat_session(project_root, "session1").unwrap();

        // Verify it's gone
        assert!(load_chat_history(project_root, "session1").is_err());
    }
}
