//! Repository implementation for agent persistence.
//!
//! This module provides CRUD operations for agent sessions and messages
//! stored in the global SQLite database.

use crate::features::agent::types::{
    AgentError, AgentResult, Message, MessageRole, SessionInfo,
};
use rusqlite::{Connection, params};

// ============================================================================
// Schema Initialization
// ============================================================================

/// Initialize the agent storage schema in the given database connection.
///
/// This function creates the necessary tables and indexes if they don't exist.
/// It should be called during database initialization.
pub fn init_schema(conn: &Connection) -> AgentResult<()> {
    conn.execute_batch(crate::features::agent::storage::SCHEMA_SQL)
        .map_err(|e| AgentError::DatabaseError(format!("Failed to init schema: {}", e)))?;
    Ok(())
}

// ============================================================================
// Session Operations
// ============================================================================

/// Create a new chat session.
///
/// # Arguments
///
/// * `conn` - Database connection
/// * `id` - Unique session ID (use UUID)
/// * `title` - Session title
///
/// # Returns
///
/// The session ID if successful
pub fn create_session(conn: &Connection, id: &str, title: &str) -> AgentResult<String> {
    let now = chrono::Utc::now().timestamp();

    conn.execute(
        "INSERT INTO agent_sessions (id, title, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?3)",
        params![id, title, now],
    )
    .map_err(|e| AgentError::DatabaseError(format!("Failed to create session: {}", e)))?;

    Ok(id.to_string())
}

/// Get all sessions ordered by most recently updated.
pub fn get_sessions(conn: &Connection) -> AgentResult<Vec<SessionInfo>> {
    let mut stmt = conn.prepare(
        "SELECT s.id, s.title, s.created_at, s.updated_at, s.last_model_id, s.last_provider,
                COUNT(m.id) as message_count,
                (SELECT content FROM agent_messages WHERE session_id = s.id AND role != 'system'
                 ORDER BY created_at DESC LIMIT 1) as last_message
         FROM agent_sessions s
         LEFT JOIN agent_messages m ON s.id = m.session_id
         GROUP BY s.id
         ORDER BY s.updated_at DESC",
    )?;

    let sessions = stmt
        .query_map([], |row| {
            let created_at: i64 = row.get(2)?;
            let updated_at: i64 = row.get(3)?;
            let message_count: i64 = row.get(6)?;

            Ok(SessionInfo {
                id: row.get(0)?,
                title: row.get(1)?,
                created_at: chrono::DateTime::from_timestamp(created_at, 0)
                    .unwrap()
                    .to_rfc3339(),
                updated_at: chrono::DateTime::from_timestamp(updated_at, 0)
                    .unwrap()
                    .to_rfc3339(),
                message_count: message_count as u32,
                last_message: row.get(7)?,
                model_id: row.get(4)?,
                provider: row
                    .get::<_, Option<String>>(5)?
                    .and_then(|p| crate::features::agent::types::ProviderType::parse(&p)),
            })
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| AgentError::DatabaseError(format!("Failed to parse sessions: {}", e)))?;

    Ok(sessions)
}

/// Get a specific session by ID.
///
/// # Returns
///
/// `Some(SessionInfo)` if found, `None` otherwise
pub fn get_session(conn: &Connection, id: &str) -> AgentResult<Option<SessionInfo>> {
    let mut stmt = conn.prepare(
        "SELECT s.id, s.title, s.created_at, s.updated_at, s.last_model_id, s.last_provider,
                COUNT(m.id) as message_count,
                (SELECT content FROM agent_messages WHERE session_id = s.id AND role != 'system'
                 ORDER BY created_at DESC LIMIT 1) as last_message
         FROM agent_sessions s
         LEFT JOIN agent_messages m ON s.id = m.session_id
         WHERE s.id = ?1
         GROUP BY s.id",
    )?;

    let mut rows = stmt.query(params![id])?;

    if let Some(row) = rows.next()? {
        let created_at: i64 = row.get(2)?;
        let updated_at: i64 = row.get(3)?;
        let message_count: i64 = row.get(6)?;

        Ok(Some(SessionInfo {
            id: row.get(0)?,
            title: row.get(1)?,
            created_at: chrono::DateTime::from_timestamp(created_at, 0)
                .unwrap()
                .to_rfc3339(),
            updated_at: chrono::DateTime::from_timestamp(updated_at, 0)
                .unwrap()
                .to_rfc3339(),
            message_count: message_count as u32,
            last_message: row.get(7)?,
            model_id: row.get(4)?,
            provider: row
                .get::<_, Option<String>>(5)?
                .and_then(|p| crate::features::agent::types::ProviderType::parse(&p)),
        }))
    } else {
        Ok(None)
    }
}

/// Update a session's title.
pub fn update_session_title(conn: &Connection, id: &str, title: &str) -> AgentResult<()> {
    let now = chrono::Utc::now().timestamp();

    let rows_affected = conn
        .execute(
            "UPDATE agent_sessions SET title = ?1, updated_at = ?2 WHERE id = ?3",
            params![title, now, id],
        )
        .map_err(|e| AgentError::DatabaseError(format!("Failed to update session: {}", e)))?;

    if rows_affected == 0 {
        return Err(AgentError::SessionNotFound(id.to_string()));
    }

    Ok(())
}

/// Update a session's last used model and provider.
pub fn update_session_model(
    conn: &Connection,
    id: &str,
    model_id: &str,
    provider: &str,
) -> AgentResult<()> {
    let now = chrono::Utc::now().timestamp();

    let rows_affected = conn.execute(
        "UPDATE agent_sessions SET last_model_id = ?1, last_provider = ?2, updated_at = ?3
         WHERE id = ?4",
        params![model_id, provider, now, id],
    )
    .map_err(|e| AgentError::DatabaseError(format!("Failed to update session model: {}", e)))?;

    if rows_affected == 0 {
        return Err(AgentError::SessionNotFound(id.to_string()));
    }

    Ok(())
}

/// Delete a session and all its messages (cascade).
pub fn delete_session(conn: &Connection, id: &str) -> AgentResult<()> {
    let rows_affected = conn
        .execute("DELETE FROM agent_sessions WHERE id = ?1", params![id])
        .map_err(|e| AgentError::DatabaseError(format!("Failed to delete session: {}", e)))?;

    if rows_affected == 0 {
        return Err(AgentError::SessionNotFound(id.to_string()));
    }

    Ok(())
}

// ============================================================================
// Message Operations
// ============================================================================

/// Save a message to the database.
///
/// Automatically updates the session's updated_at timestamp.
pub fn save_message(conn: &Connection, session_id: &str, message: &Message) -> AgentResult<()> {
    let now = chrono::Utc::now().timestamp();
    let created_at = message
        .created_at
        .parse::<chrono::DateTime<chrono::Utc>>()
        .map(|dt| dt.timestamp())
        .unwrap_or(now);

    conn.execute(
        "INSERT INTO agent_messages
         (id, session_id, role, content, created_at, model_id, provider,
          tool_call_id, tool_name, tool_args_json, tool_result_json)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            &message.id,
            session_id,
            message.role.to_string(),
            &message.content,
            created_at,
            &message.model_id,
            message.provider.as_ref().map(|p| p.to_string()),
            &message.tool_call_id,
            &message.tool_name,
            &message.tool_args_json,
            &message.tool_result_json,
        ],
    )
    .map_err(|e| AgentError::DatabaseError(format!("Failed to save message: {}", e)))?;

    // Update session's updated_at timestamp
    conn.execute(
        "UPDATE agent_sessions SET updated_at = ?1 WHERE id = ?2",
        params![now, session_id],
    )
    .map_err(|e| AgentError::DatabaseError(format!("Failed to update session: {}", e)))?;

    Ok(())
}

/// Save multiple messages in a single transaction.
pub fn save_messages(conn: &mut Connection, session_id: &str, messages: &[Message]) -> AgentResult<()> {
    let tx = conn
        .transaction()
        .map_err(|e| AgentError::DatabaseError(format!("Failed to start transaction: {}", e)))?;

    for message in messages {
        // Save each message within the transaction
        let now = chrono::Utc::now().timestamp();
        let created_at = message
            .created_at
            .parse::<chrono::DateTime<chrono::Utc>>()
            .map(|dt| dt.timestamp())
            .unwrap_or(now);

        tx.execute(
            "INSERT INTO agent_messages
             (id, session_id, role, content, created_at, model_id, provider,
              tool_call_id, tool_name, tool_args_json, tool_result_json)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                &message.id,
                session_id,
                message.role.to_string(),
                &message.content,
                created_at,
                &message.model_id,
                message.provider.as_ref().map(|p| p.to_string()),
                &message.tool_call_id,
                &message.tool_name,
                &message.tool_args_json,
                &message.tool_result_json,
            ],
        )
        .map_err(|e| AgentError::DatabaseError(format!("Failed to save message: {}", e)))?;
    }

    // Update session's updated_at timestamp once at the end
    let now = chrono::Utc::now().timestamp();
    tx.execute(
        "UPDATE agent_sessions SET updated_at = ?1 WHERE id = ?2",
        params![now, session_id],
    )
    .map_err(|e| AgentError::DatabaseError(format!("Failed to update session: {}", e)))?;

    tx.commit()
        .map_err(|e| AgentError::DatabaseError(format!("Failed to commit transaction: {}", e)))?;

    Ok(())
}

/// Get all messages for a session in chronological order.
pub fn get_messages(conn: &Connection, session_id: &str) -> AgentResult<Vec<Message>> {
    let mut stmt = conn.prepare(
        "SELECT id, role, content, created_at, model_id, provider,
                tool_call_id, tool_name, tool_args_json, tool_result_json
         FROM agent_messages
         WHERE session_id = ?1
         ORDER BY created_at ASC",
    )?;

    let messages = stmt
        .query_map(params![session_id], |row| {
            let created_at: i64 = row.get(3)?;
            let role_str: String = row.get(1)?;
            let role = match role_str.as_str() {
                "system" => MessageRole::System,
                "user" => MessageRole::User,
                "assistant" => MessageRole::Assistant,
                "tool" => MessageRole::Tool,
                _ => MessageRole::User, // Default fallback
            };

            Ok(Message {
                id: row.get(0)?,
                role,
                content: row.get(2)?,
                created_at: chrono::DateTime::from_timestamp(created_at, 0)
                    .unwrap()
                    .to_rfc3339(),
                model_id: row.get(4)?,
                provider: row
                    .get::<_, Option<String>>(5)?
                    .and_then(|p| crate::features::agent::types::ProviderType::parse(&p)),
                tool_call_id: row.get(6)?,
                tool_name: row.get(7)?,
                tool_args_json: row.get(8)?,
                tool_result_json: row.get(9)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| AgentError::DatabaseError(format!("Failed to parse messages: {}", e)))?;

    Ok(messages)
}

/// Get a specific message by ID.
pub fn get_message(conn: &Connection, message_id: &str) -> AgentResult<Option<Message>> {
    let mut stmt = conn.prepare(
        "SELECT id, role, content, created_at, model_id, provider,
                tool_call_id, tool_name, tool_args_json, tool_result_json
         FROM agent_messages
         WHERE id = ?1",
    )?;

    let mut rows = stmt.query(params![message_id])?;

    if let Some(row) = rows.next()? {
        let created_at: i64 = row.get(2)?;
        let role_str: String = row.get(1)?;
        let role = match role_str.as_str() {
            "system" => MessageRole::System,
            "user" => MessageRole::User,
            "assistant" => MessageRole::Assistant,
            "tool" => MessageRole::Tool,
            _ => MessageRole::User,
        };

        Ok(Some(Message {
            id: row.get(0)?,
            role,
            content: row.get(2)?,
            created_at: chrono::DateTime::from_timestamp(created_at, 0)
                .unwrap()
                .to_rfc3339(),
            model_id: row.get(3)?,
            provider: row
                .get::<_, Option<String>>(4)?
                .and_then(|p| crate::features::agent::types::ProviderType::parse(&p)),
            tool_call_id: row.get(5)?,
            tool_name: row.get(6)?,
            tool_args_json: row.get(7)?,
            tool_result_json: row.get(8)?,
        }))
    } else {
        Ok(None)
    }
}

/// Delete a specific message.
pub fn delete_message(conn: &Connection, message_id: &str) -> AgentResult<()> {
    conn.execute("DELETE FROM agent_messages WHERE id = ?1", params![message_id])
        .map_err(|e| AgentError::DatabaseError(format!("Failed to delete message: {}", e)))?;

    Ok(())
}

/// Delete all messages for a session (but keep the session).
pub fn clear_session_messages(conn: &Connection, session_id: &str) -> AgentResult<()> {
    conn.execute(
        "DELETE FROM agent_messages WHERE session_id = ?1",
        params![session_id],
    )
    .map_err(|e| AgentError::DatabaseError(format!("Failed to clear messages: {}", e)))?;

    Ok(())
}

/// Count messages in a session.
pub fn count_messages(conn: &Connection, session_id: &str) -> AgentResult<i64> {
    conn.query_row(
        "SELECT COUNT(*) FROM agent_messages WHERE session_id = ?1",
        params![session_id],
        |row| row.get(0),
    )
    .map_err(|e| AgentError::DatabaseError(format!("Failed to count messages: {}", e)))
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Check if a session exists.
pub fn session_exists(conn: &Connection, id: &str) -> AgentResult<bool> {
    let exists: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM agent_sessions WHERE id = ?1)",
            params![id],
            |row| row.get(0),
        )
        .unwrap_or(false);

    Ok(exists)
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
        init_schema(&conn).unwrap();
        conn
    }

    #[test]
    fn test_schema_creation() {
        let conn = setup_test_db();

        // Verify tables exist
        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert!(tables.contains(&"agent_sessions".to_string()));
        assert!(tables.contains(&"agent_messages".to_string()));
    }

    #[test]
    fn test_create_session() {
        let conn = setup_test_db();
        let id = "test-session-1";
        let title = "Test Session";

        let result = create_session(&conn, id, title).unwrap();
        assert_eq!(result, id);

        // Verify session was created
        let info = get_session(&conn, id).unwrap();
        assert!(info.is_some());
        let session = info.unwrap();
        assert_eq!(session.id, id);
        assert_eq!(session.title, title);
        assert_eq!(session.message_count, 0);
    }

    #[test]
    fn test_get_sessions_empty() {
        let conn = setup_test_db();

        let sessions = get_sessions(&conn).unwrap();
        assert!(sessions.is_empty());
    }

    #[test]
    fn test_get_sessions_multiple() {
        let conn = setup_test_db();

        // Create sessions in reverse chronological order
        create_session(&conn, "session-2", "Session 2").unwrap();
        std::thread::sleep(std::time::Duration::from_millis(10));
        create_session(&conn, "session-1", "Session 1").unwrap();

        let sessions = get_sessions(&conn).unwrap();
        assert_eq!(sessions.len(), 2);
        // Most recently updated should be first
        assert_eq!(sessions[0].id, "session-1");
        assert_eq!(sessions[1].id, "session-2");
    }

    #[test]
    fn test_update_session_title() {
        let conn = setup_test_db();
        let id = "test-session";
        create_session(&conn, id, "Original Title").unwrap();

        update_session_title(&conn, id, "Updated Title").unwrap();

        let session = get_session(&conn, id).unwrap().unwrap();
        assert_eq!(session.title, "Updated Title");
    }

    #[test]
    fn test_update_session_model() {
        let conn = setup_test_db();
        let id = "test-session";
        create_session(&conn, id, "Test").unwrap();

        update_session_model(&conn, id, "gemini-2.5-flash", "google").unwrap();

        let session = get_session(&conn, id).unwrap().unwrap();
        assert_eq!(session.model_id, Some("gemini-2.5-flash".to_string()));
        assert_eq!(session.provider, Some(crate::features::agent::types::ProviderType::Google));
    }

    #[test]
    fn test_delete_session() {
        let conn = setup_test_db();
        let id = "test-session";
        create_session(&conn, id, "Test").unwrap();

        // Verify session exists
        assert!(session_exists(&conn, id).unwrap());

        delete_session(&conn, id).unwrap();

        // Verify session is deleted
        assert!(!session_exists(&conn, id).unwrap());
        let session = get_session(&conn, id).unwrap();
        assert!(session.is_none());
    }

    #[test]
    fn test_save_and_get_message() {
        let conn = setup_test_db();
        let session_id = "test-session";
        create_session(&conn, session_id, "Test").unwrap();

        let message = Message::user("Hello, world!");
        save_message(&conn, session_id, &message).unwrap();

        let messages = get_messages(&conn, session_id).unwrap();
        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].role, MessageRole::User);
        assert_eq!(messages[0].content, "Hello, world!");
    }

    #[test]
    fn test_save_multiple_messages() {
        let mut conn = setup_test_db();
        let session_id = "test-session";
        create_session(&conn, session_id, "Test").unwrap();

        let messages = vec![
            Message::user("Question 1"),
            Message::assistant("Answer 1"),
            Message::user("Question 2"),
        ];

        save_messages(&mut conn, session_id, &messages).unwrap();

        let loaded = get_messages(&conn, session_id).unwrap();
        assert_eq!(loaded.len(), 3);
        assert_eq!(loaded[0].content, "Question 1");
        assert_eq!(loaded[1].content, "Answer 1");
        assert_eq!(loaded[2].content, "Question 2");
    }

    #[test]
    fn test_message_ordering() {
        let conn = setup_test_db();
        let session_id = "test-session";
        create_session(&conn, session_id, "Test").unwrap();

        // Save messages with delays to ensure different timestamps
        save_message(&conn, session_id, &Message::user("First")).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(10));
        save_message(&conn, session_id, &Message::assistant("Response")).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(10));
        save_message(&conn, session_id, &Message::user("Second")).unwrap();

        let messages = get_messages(&conn, session_id).unwrap();
        assert_eq!(messages.len(), 3);
        assert_eq!(messages[0].content, "First");
        assert_eq!(messages[1].content, "Response");
        assert_eq!(messages[2].content, "Second");
    }

    #[test]
    fn test_count_messages() {
        let conn = setup_test_db();
        let session_id = "test-session";
        create_session(&conn, session_id, "Test").unwrap();

        assert_eq!(count_messages(&conn, session_id).unwrap(), 0);

        save_message(&conn, session_id, &Message::user("Test")).unwrap();
        assert_eq!(count_messages(&conn, session_id).unwrap(), 1);

        save_message(&conn, session_id, &Message::assistant("Reply")).unwrap();
        assert_eq!(count_messages(&conn, session_id).unwrap(), 2);
    }

    #[test]
    fn test_clear_session_messages() {
        let conn = setup_test_db();
        let session_id = "test-session";
        create_session(&conn, session_id, "Test").unwrap();

        save_message(&conn, session_id, &Message::user("Test")).unwrap();
        save_message(&conn, session_id, &Message::assistant("Reply")).unwrap();

        clear_session_messages(&conn, session_id).unwrap();

        let messages = get_messages(&conn, session_id).unwrap();
        assert!(messages.is_empty());

        // Session should still exist
        assert!(session_exists(&conn, session_id).unwrap());
    }

    #[test]
    fn test_cascade_delete_session_deletes_messages() {
        let conn = setup_test_db();
        let session_id = "test-session";
        create_session(&conn, session_id, "Test").unwrap();

        save_message(&conn, session_id, &Message::user("Test")).unwrap();

        // Delete the session
        delete_session(&conn, session_id).unwrap();

        // Messages should also be deleted (cascade)
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM agent_messages WHERE session_id = ?1",
                params![session_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn test_session_message_count() {
        let conn = setup_test_db();
        let session_id = "test-session";
        create_session(&conn, session_id, "Test").unwrap();

        save_message(&conn, session_id, &Message::user("Q1")).unwrap();
        save_message(&conn, session_id, &Message::assistant("A1")).unwrap();

        let session = get_session(&conn, session_id).unwrap().unwrap();
        assert_eq!(session.message_count, 2);
    }

    #[test]
    fn test_session_not_found() {
        let conn = setup_test_db();

        let result = get_session(&conn, "non-existent");
        assert!(result.is_ok());
        assert!(result.unwrap().is_none());

        let err = update_session_title(&conn, "non-existent", "New Title");
        assert!(matches!(err, Err(AgentError::SessionNotFound(_))));

        let err = delete_session(&conn, "non-existent");
        assert!(matches!(err, Err(AgentError::SessionNotFound(_))));
    }

    #[test]
    fn test_tool_message_fields() {
        let conn = setup_test_db();
        let session_id = "test-session";
        create_session(&conn, session_id, "Test").unwrap();

        let mut message = Message::assistant("I'll call a tool");
        message.tool_args_json = Some(r#"{"query": "test"}"#.to_string());

        save_message(&conn, session_id, &message).unwrap();

        let messages = get_messages(&conn, session_id).unwrap();
        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].tool_args_json, Some(r#"{"query": "test"}"#.to_string()));
    }
}
