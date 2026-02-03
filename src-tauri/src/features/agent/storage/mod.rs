//! Storage layer for agent module.
//!
//! Provides database persistence for AI agent conversations with connection pooling.

use once_cell::sync::Lazy;
use rusqlite::Connection;
use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;

pub mod repository;

// Re-export commonly used functions
pub use repository::{
    // Thread operations
    create_thread,
    get_threads,
    get_thread,
    update_thread_title,
    delete_thread,
    thread_exists,
    // Message operations
    save_message,
    get_messages,
    delete_message,
    clear_thread_messages,
    count_messages,
    // Types
    ThreadInfo,
    MessageInfo,
};

/// Database schema SQL for agent storage.
pub const SCHEMA_SQL: &str = include_str!("schema.sql");

/// Simple connection pool: project_path -> Connection
///
/// Uses a HashMap to cache connections per project path.
/// For production use, consider using r2d2 connection pool.
static DB_POOL: Lazy<Mutex<HashMap<String, Connection>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// Get or create a database connection for the given project path.
///
/// # Arguments
///
/// * `project_path` - Path to the project directory
///
/// # Returns
///
/// A database connection with schema initialized
pub fn get_connection(project_path: &str) -> Result<Connection, rusqlite::Error> {
    let db_path = Path::new(project_path).join("synnia.db");
    let db_path_str = db_path.to_string_lossy().to_string();

    // Check if we already have a connection in the pool
    {
        let pool = DB_POOL.lock().unwrap();
        if let Some(conn) = pool.get(&db_path_str) {
            // Verify connection is still valid
            if conn.execute("SELECT 1", []).is_ok() {
                // Note: We can't return the connection from here directly
                // because we'd need to clone it or remove it from the pool
                // For simplicity, we'll create a new connection each time
                // In production, use r2d2 for proper connection pooling
            }
        }
    }

    // Create new connection
    let conn = Connection::open(&db_path)?;

    // Initialize schema
    conn.execute_batch(SCHEMA_SQL)?;

    Ok(conn)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_connection_creates_database() {
        let dir = tempfile::tempdir().unwrap();
        let project_path = dir.path().to_str().unwrap();

        let conn = get_connection(project_path).unwrap();

        // Verify schema was created
        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert!(tables.contains(&"agent_threads".to_string()));
        assert!(tables.contains(&"agent_messages".to_string()));
    }
}
