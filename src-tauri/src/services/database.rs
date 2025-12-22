//! SQLite database initialization and connection management.
//!
//! This module provides:
//! - Database initialization with WAL mode
//! - Schema creation for all tables
//! - Connection pooling helpers

use rusqlite::{Connection, Result as SqliteResult};
use std::path::Path;
use std::sync::Mutex;

/// Database schema version for migrations
const SCHEMA_VERSION: i32 = 1;

/// Initialize the database at the given path.
/// Creates all tables if they don't exist and enables WAL mode.
pub fn init_db(db_path: &Path) -> SqliteResult<Connection> {
    let conn = Connection::open(db_path)?;
    
    // Enable WAL mode for better concurrency
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")?;
    
    // Create schema
    conn.execute_batch(SCHEMA_SQL)?;
    
    // Set schema version
    conn.pragma_update(None, "user_version", SCHEMA_VERSION)?;
    
    Ok(conn)
}

/// Open an existing database connection.
pub fn open_db(db_path: &Path) -> SqliteResult<Connection> {
    let conn = Connection::open(db_path)?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")?;
    Ok(conn)
}

/// Thread-safe database wrapper
pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new(db_path: &Path) -> SqliteResult<Self> {
        let conn = if db_path.exists() {
            open_db(db_path)?
        } else {
            init_db(db_path)?
        };
        Ok(Self { conn: Mutex::new(conn) })
    }
    
    pub fn with_conn<F, T>(&self, f: F) -> SqliteResult<T>
    where
        F: FnOnce(&Connection) -> SqliteResult<T>,
    {
        let conn = self.conn.lock().map_err(|_| {
            rusqlite::Error::SqliteFailure(
                rusqlite::ffi::Error::new(1),
                Some("Lock poisoned".to_string()),
            )
        })?;
        f(&conn)
    }
}

/// Database schema SQL
const SCHEMA_SQL: &str = r#"
-- Project metadata
CREATE TABLE IF NOT EXISTS project_meta (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    author TEXT,
    thumbnail TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Viewport state
CREATE TABLE IF NOT EXISTS viewport (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    x REAL NOT NULL DEFAULT 0,
    y REAL NOT NULL DEFAULT 0,
    zoom REAL NOT NULL DEFAULT 1
);

-- Initialize viewport with default values
INSERT OR IGNORE INTO viewport (id, x, y, zoom) VALUES (1, 0, 0, 1);

-- Nodes (view layer)
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    width REAL,
    height REAL,
    parent_id TEXT,
    extent TEXT,
    style_json TEXT,
    data_json TEXT NOT NULL
);

-- Edges
CREATE TABLE IF NOT EXISTS edges (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    target TEXT NOT NULL,
    source_handle TEXT,
    target_handle TEXT,
    type TEXT,
    label TEXT,
    animated INTEGER DEFAULT 0
);

-- Assets (data layer) - New unified structure
CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    value_type TEXT NOT NULL,
    value_hash TEXT NOT NULL,
    value_json TEXT NOT NULL,
    value_meta_json TEXT,
    config_json TEXT,
    sys_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Asset version history (CAS - Content Addressable Storage)
CREATE TABLE IF NOT EXISTS asset_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    content_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

-- Deduplication index: same asset + same hash = no duplicate
CREATE UNIQUE INDEX IF NOT EXISTS idx_history_dedup 
    ON asset_history(asset_id, content_hash);

-- Time-ordered index for history retrieval
CREATE INDEX IF NOT EXISTS idx_history_time 
    ON asset_history(asset_id, created_at DESC);

-- Index for asset lookup by hash
CREATE INDEX IF NOT EXISTS idx_asset_hash 
    ON assets(value_hash);

-- Project settings (key-value store)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL
);
"#;

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use tempfile::tempdir;

    #[test]
    fn test_init_db() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        
        let conn = init_db(&db_path).expect("Failed to init db");
        
        // Verify tables exist
        let count: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='assets'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        
        assert_eq!(count, 1, "assets table should exist");
    }

    #[test]
    fn test_database_wrapper() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        
        let db = Database::new(&db_path).expect("Failed to create database");
        
        let result = db.with_conn(|conn| {
            conn.query_row("SELECT 1 + 1", [], |row| row.get::<_, i32>(0))
        }).unwrap();
        
        assert_eq!(result, 2);
    }
}
