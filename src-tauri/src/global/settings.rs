//! Global application settings management.
//!
//! Supports both simple key-value pairs and complex JSON objects.

use rusqlite::{Connection, params};
use serde::{de::DeserializeOwned, Serialize};

use crate::core::AppError;

/// Get a simple string setting by key.
pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>, AppError> {
    let result: Option<String> = conn.query_row(
        "SELECT value FROM app_settings WHERE key = ?1",
        params![key],
        |row| row.get(0)
    ).ok();
    
    Ok(result)
}

/// Set a simple string setting.
pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<(), AppError> {
    let now = chrono::Utc::now().timestamp();
    
    conn.execute(
        "INSERT INTO app_settings (key, value, updated_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        params![key, value, now]
    ).map_err(|e| AppError::Database(format!("Failed to set setting '{}': {}", key, e)))?;
    
    Ok(())
}

/// Get a JSON setting, deserializing to the specified type.
pub fn get_json_setting<T: DeserializeOwned>(conn: &Connection, key: &str) -> Result<Option<T>, AppError> {
    let json_str: Option<String> = conn.query_row(
        "SELECT json_value FROM app_settings WHERE key = ?1",
        params![key],
        |row| row.get(0)
    ).ok().flatten();
    
    match json_str {
        Some(s) => {
            let value: T = serde_json::from_str(&s)
                .map_err(|e| AppError::Serialization(format!("Failed to parse setting '{}': {}", key, e)))?;
            Ok(Some(value))
        }
        None => Ok(None)
    }
}

/// Set a JSON setting, serializing from the specified type.
pub fn set_json_setting<T: Serialize>(conn: &Connection, key: &str, value: &T) -> Result<(), AppError> {
    let json_str = serde_json::to_string(value)
        .map_err(|e| AppError::Serialization(format!("Failed to serialize setting '{}': {}", key, e)))?;
    
    let now = chrono::Utc::now().timestamp();
    
    conn.execute(
        "INSERT INTO app_settings (key, json_value, updated_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(key) DO UPDATE SET json_value = excluded.json_value, updated_at = excluded.updated_at",
        params![key, json_str, now]
    ).map_err(|e| AppError::Database(format!("Failed to set setting '{}': {}", key, e)))?;
    
    Ok(())
}

/// Delete a setting by key.
pub fn delete_setting(conn: &Connection, key: &str) -> Result<bool, AppError> {
    let deleted = conn.execute(
        "DELETE FROM app_settings WHERE key = ?1",
        params![key]
    ).map_err(|e| AppError::Database(format!("Failed to delete setting '{}': {}", key, e)))?;
    
    Ok(deleted > 0)
}

/// List all setting keys.
pub fn list_settings(conn: &Connection) -> Result<Vec<String>, AppError> {
    let mut stmt = conn.prepare("SELECT key FROM app_settings ORDER BY key")
        .map_err(|e| AppError::Database(format!("Failed to prepare query: {}", e)))?;
    
    let keys = stmt.query_map([], |row| row.get(0))
        .map_err(|e| AppError::Database(format!("Query failed: {}", e)))?
        .filter_map(|r| r.ok())
        .collect();
    
    Ok(keys)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::{Deserialize, Serialize};
    
    #[derive(Debug, Serialize, Deserialize, PartialEq)]
    struct TestConfig {
        name: String,
        value: i32,
    }
    
    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE app_settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                json_value TEXT,
                updated_at INTEGER NOT NULL
            )"
        ).unwrap();
        conn
    }
    
    #[test]
    fn test_simple_setting() {
        let conn = setup_test_db();
        
        set_setting(&conn, "theme", "dark").unwrap();
        let value = get_setting(&conn, "theme").unwrap();
        assert_eq!(value, Some("dark".to_string()));
    }
    
    #[test]
    fn test_json_setting() {
        let conn = setup_test_db();
        
        let config = TestConfig { name: "test".to_string(), value: 42 };
        set_json_setting(&conn, "config", &config).unwrap();
        
        let loaded: Option<TestConfig> = get_json_setting(&conn, "config").unwrap();
        assert_eq!(loaded, Some(config));
    }
}
