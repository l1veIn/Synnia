//! Repository implementation for agent_new persistence.
//!
//! Provides CRUD operations for threads and messages stored in SQLite.

use super::get_connection;
use rusqlite::params;

// ============================================================================
// Types
// ============================================================================

/// Thread information returned from the database.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThreadInfo {
    pub id: String,
    pub title: String,
    pub model_id: String,
    pub provider: String,
    pub created_at: String,
    pub updated_at: String,
}

/// Message information returned from the database.
/// The content_json field contains the full assistant-ui message format.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageInfo {
    pub id: String,
    pub role: String,
    pub content_json: String,
    pub model_id: Option<String>,
    pub provider: Option<String>,
    pub created_at: String,
}

// ============================================================================
// Thread Operations
// ============================================================================

/// Create a new thread (conversation).
///
/// # Arguments
///
/// * `project_path` - Path to the project directory
/// * `model_id` - Model identifier (e.g., "gemini-2.5-flash")
/// * `provider` - Provider name (e.g., "google", "openai")
///
/// # Returns
///
/// The new thread ID if successful
pub fn create_thread(
    project_path: &str,
    model_id: &str,
    provider: &str,
) -> Result<String, rusqlite::Error> {
    let conn = get_connection(project_path)?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO agent_threads (id, title, model_id, provider, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, "New Chat", model_id, provider, now, now],
    )?;

    Ok(id)
}

/// Get all threads ordered by most recently updated.
pub fn get_threads(project_path: &str) -> Result<Vec<ThreadInfo>, rusqlite::Error> {
    let conn = get_connection(project_path)?;
    let mut stmt = conn.prepare(
        "SELECT id, title, model_id, provider, created_at, updated_at
         FROM agent_threads
         ORDER BY updated_at DESC",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(ThreadInfo {
            id: row.get(0)?,
            title: row.get(1)?,
            model_id: row.get(2)?,
            provider: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        })
    })?;

    rows.collect()
}

/// Get a specific thread by ID.
///
/// # Returns
///
/// `Some(ThreadInfo)` if found, `None` otherwise
pub fn get_thread(project_path: &str, id: &str) -> Result<Option<ThreadInfo>, rusqlite::Error> {
    let conn = get_connection(project_path)?;
    let mut stmt = conn.prepare(
        "SELECT id, title, model_id, provider, created_at, updated_at
         FROM agent_threads
         WHERE id = ?1",
    )?;

    let mut rows = stmt.query(params![id])?;

    if let Some(row) = rows.next()? {
        Ok(Some(ThreadInfo {
            id: row.get(0)?,
            title: row.get(1)?,
            model_id: row.get(2)?,
            provider: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        }))
    } else {
        Ok(None)
    }
}

/// Update a thread's title.
pub fn update_thread_title(
    project_path: &str,
    id: &str,
    title: &str,
) -> Result<(), rusqlite::Error> {
    let conn = get_connection(project_path)?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE agent_threads SET title = ?1, updated_at = ?2 WHERE id = ?3",
        params![title, now, id],
    )?;

    Ok(())
}

/// Delete a thread and all its messages (cascade).
pub fn delete_thread(project_path: &str, id: &str) -> Result<(), rusqlite::Error> {
    let conn = get_connection(project_path)?;
    conn.execute("DELETE FROM agent_threads WHERE id = ?1", params![id])?;
    Ok(())
}

/// Check if a thread exists.
pub fn thread_exists(project_path: &str, id: &str) -> Result<bool, rusqlite::Error> {
    let conn = get_connection(project_path)?;
    let exists: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM agent_threads WHERE id = ?1)",
            params![id],
            |row| row.get(0),
        )
        .unwrap_or(false);
    Ok(exists)
}

// ============================================================================
// Message Operations
// ============================================================================

/// Save a message to the database.
///
/// Automatically updates the thread's updated_at timestamp.
///
/// # Arguments
///
/// * `project_path` - Path to the project directory
/// * `thread_id` - Thread ID
/// * `message_id` - Unique message ID
/// * `role` - Message role: "user" or "assistant"
/// * `content_json` - Full assistant-ui message format as JSON string
/// * `model_id` - Optional model identifier
/// * `provider` - Optional provider name
pub fn save_message(
    project_path: &str,
    thread_id: &str,
    message_id: &str,
    role: &str,
    content_json: &str,
    model_id: Option<&str>,
    provider: Option<&str>,
) -> Result<(), rusqlite::Error> {
    let conn = get_connection(project_path)?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO agent_messages (id, thread_id, role, content_json, model_id, provider, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![message_id, thread_id, role, content_json, model_id, provider, now],
    )?;

    // Update thread's updated_at timestamp
    conn.execute(
        "UPDATE agent_threads SET updated_at = ?1 WHERE id = ?2",
        params![now, thread_id],
    )?;

    Ok(())
}

/// Get all messages for a thread in chronological order.
pub fn get_messages(project_path: &str, thread_id: &str) -> Result<Vec<MessageInfo>, rusqlite::Error> {
    let conn = get_connection(project_path)?;
    let mut stmt = conn.prepare(
        "SELECT id, role, content_json, model_id, provider, created_at
         FROM agent_messages
         WHERE thread_id = ?1
         ORDER BY created_at ASC",
    )?;

    let rows = stmt.query_map(params![thread_id], |row| {
        Ok(MessageInfo {
            id: row.get(0)?,
            role: row.get(1)?,
            content_json: row.get(2)?,
            model_id: row.get(3)?,
            provider: row.get(4)?,
            created_at: row.get(5)?,
        })
    })?;

    rows.collect()
}

/// Delete a specific message.
pub fn delete_message(project_path: &str, message_id: &str) -> Result<(), rusqlite::Error> {
    let conn = get_connection(project_path)?;
    conn.execute(
        "DELETE FROM agent_messages WHERE id = ?1",
        params![message_id],
    )?;
    Ok(())
}

/// Delete all messages for a thread (but keep the thread).
pub fn clear_thread_messages(
    project_path: &str,
    thread_id: &str,
) -> Result<(), rusqlite::Error> {
    let conn = get_connection(project_path)?;
    conn.execute(
        "DELETE FROM agent_messages WHERE thread_id = ?1",
        params![thread_id],
    )?;
    Ok(())
}

/// Count messages in a thread.
pub fn count_messages(project_path: &str, thread_id: &str) -> Result<i64, rusqlite::Error> {
    let conn = get_connection(project_path)?;
    conn.query_row(
        "SELECT COUNT(*) FROM agent_messages WHERE thread_id = ?1",
        params![thread_id],
        |row| row.get(0),
    )
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    /// Create an in-memory database for testing.
    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(super::super::SCHEMA_SQL).unwrap();
        conn
    }

    /// Get a temporary project path for testing.
    /// The TempDir is leaked to keep the directory alive for the test duration.
    fn temp_project_path() -> String {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().to_str().unwrap().to_string();
        // Leak the TempDir to prevent it from being dropped (and directory deleted)
        Box::leak(Box::new(dir));
        path
    }

    #[test]
    fn test_create_and_list_threads() {
        let project_path = temp_project_path();

        let id = create_thread(&project_path, "gemini-2.5-flash", "google").unwrap();
        assert!(!id.is_empty());

        let threads = get_threads(&project_path).unwrap();
        assert_eq!(threads.len(), 1);
        assert_eq!(threads[0].id, id);
        assert_eq!(threads[0].title, "New Chat");
        assert_eq!(threads[0].model_id, "gemini-2.5-flash");
        assert_eq!(threads[0].provider, "google");
    }

    #[test]
    fn test_get_thread_by_id() {
        let project_path = temp_project_path();

        let id = create_thread(&project_path, "gpt-4", "openai").unwrap();

        let thread = get_thread(&project_path, &id).unwrap();
        assert!(thread.is_some());
        let info = thread.unwrap();
        assert_eq!(info.id, id);
        assert_eq!(info.model_id, "gpt-4");

        // Non-existent thread
        let none_thread = get_thread(&project_path, "non-existent").unwrap();
        assert!(none_thread.is_none());
    }

    #[test]
    fn test_update_thread_title() {
        let project_path = temp_project_path();

        let id = create_thread(&project_path, "test", "test").unwrap();
        update_thread_title(&project_path, &id, "Custom Title").unwrap();

        let thread = get_thread(&project_path, &id).unwrap().unwrap();
        assert_eq!(thread.title, "Custom Title");
    }

    #[test]
    fn test_delete_thread() {
        let project_path = temp_project_path();

        let id = create_thread(&project_path, "test", "test").unwrap();
        assert!(thread_exists(&project_path, &id).unwrap());

        delete_thread(&project_path, &id).unwrap();
        assert!(!thread_exists(&project_path, &id).unwrap());
    }

    #[test]
    fn test_thread_ordering() {
        let project_path = temp_project_path();

        // Create threads with delays to ensure different timestamps
        let id1 = create_thread(&project_path, "model1", "provider1").unwrap();
        std::thread::sleep(std::time::Duration::from_millis(10));
        let id2 = create_thread(&project_path, "model2", "provider2").unwrap();

        let threads = get_threads(&project_path).unwrap();
        assert_eq!(threads.len(), 2);
        // Most recently updated should be first
        assert_eq!(threads[0].id, id2);
        assert_eq!(threads[1].id, id1);
    }

    #[test]
    fn test_save_and_get_messages() {
        let project_path = temp_project_path();

        let thread_id = create_thread(&project_path, "test", "test").unwrap();

        // Use content_json format
        let user_msg = r#"{"content":[{"type":"text","text":"Hello"}],"role":"user"}"#;
        save_message(
            &project_path,
            &thread_id,
            "msg1",
            "user",
            user_msg,
            None,
            None,
        )
        .unwrap();

        let assistant_msg = r#"{"content":[{"type":"text","text":"Hi there!"}],"role":"assistant","status":{"type":"complete"}}"#;
        save_message(
            &project_path,
            &thread_id,
            "msg2",
            "assistant",
            assistant_msg,
            Some("gemini-2.5-flash"),
            Some("google"),
        )
        .unwrap();

        let messages = get_messages(&project_path, &thread_id).unwrap();
        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0].role, "user");
        assert!(messages[0].content_json.contains("Hello"));
        assert_eq!(messages[1].role, "assistant");
        assert!(messages[1].content_json.contains("Hi there!"));
        assert_eq!(messages[1].model_id, Some("gemini-2.5-flash".to_string()));
        assert_eq!(messages[1].provider, Some("google".to_string()));
    }

    #[test]
    fn test_message_with_tool_calls() {
        let project_path = temp_project_path();

        let thread_id = create_thread(&project_path, "test", "test").unwrap();

        // Tool calls are now embedded in content_json
        let msg_with_tools = r#"{"content":[{"type":"text","text":"Let me search"},{"type":"tool-call","toolCallId":"tc_1","toolName":"search","args":{}}],"role":"assistant"}"#;
        save_message(
            &project_path,
            &thread_id,
            "msg1",
            "assistant",
            msg_with_tools,
            None,
            None,
        )
        .unwrap();

        let messages = get_messages(&project_path, &thread_id).unwrap();
        assert_eq!(messages.len(), 1);
        assert!(messages[0].content_json.contains("tool-call"));
        assert!(messages[0].content_json.contains("search"));
    }

    #[test]
    fn test_count_messages() {
        let project_path = temp_project_path();

        let thread_id = create_thread(&project_path, "test", "test").unwrap();

        assert_eq!(count_messages(&project_path, &thread_id).unwrap(), 0);

        save_message(&project_path, &thread_id, "msg1", "user", r#"{"content":[]}"#, None, None).unwrap();
        assert_eq!(count_messages(&project_path, &thread_id).unwrap(), 1);

        save_message(&project_path, &thread_id, "msg2", "assistant", r#"{"content":[]}"#, None, None)
            .unwrap();
        assert_eq!(count_messages(&project_path, &thread_id).unwrap(), 2);
    }

    #[test]
    fn test_clear_thread_messages() {
        let project_path = temp_project_path();

        let thread_id = create_thread(&project_path, "test", "test").unwrap();

        save_message(&project_path, &thread_id, "msg1", "user", r#"{"content":[]}"#, None, None).unwrap();
        save_message(&project_path, &thread_id, "msg2", "assistant", r#"{"content":[]}"#, None, None)
            .unwrap();

        clear_thread_messages(&project_path, &thread_id).unwrap();

        let messages = get_messages(&project_path, &thread_id).unwrap();
        assert!(messages.is_empty());

        // Thread should still exist
        assert!(thread_exists(&project_path, &thread_id).unwrap());
    }

    #[test]
    fn test_cascade_delete_thread_deletes_messages() {
        let project_path = temp_project_path();

        let thread_id = create_thread(&project_path, "test", "test").unwrap();

        save_message(&project_path, &thread_id, "msg1", "user", r#"{"content":[]}"#, None, None).unwrap();

        // Delete the thread
        delete_thread(&project_path, &thread_id).unwrap();

        // Messages should also be deleted (cascade)
        let conn = get_connection(&project_path).unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM agent_messages WHERE thread_id = ?1",
                params![&thread_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn test_message_updates_thread_timestamp() {
        let project_path = temp_project_path();

        let thread_id = create_thread(&project_path, "test", "test").unwrap();
        let thread_before = get_thread(&project_path, &thread_id).unwrap().unwrap();

        std::thread::sleep(std::time::Duration::from_millis(10));

        save_message(&project_path, &thread_id, "msg1", "user", r#"{"content":[]}"#, None, None).unwrap();

        let thread_after = get_thread(&project_path, &thread_id).unwrap().unwrap();

        // updated_at should be later after saving a message
        assert_ne!(thread_before.updated_at, thread_after.updated_at);
    }

    #[test]
    fn test_get_empty_threads_list() {
        let project_path = temp_project_path();

        let threads = get_threads(&project_path).unwrap();
        assert!(threads.is_empty());
    }
}
