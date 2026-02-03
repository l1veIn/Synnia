//! Global database initialization and management.
//!
//! Location: `~/.synnia/synnia.db`
//! Mode: WAL (Write-Ahead Logging) for concurrent read/write

use std::path::PathBuf;
use rusqlite::{Connection, params};

use crate::core::AppError;

/// Schema version for future migrations
const SCHEMA_VERSION: i32 = 2;

/// Complete schema SQL
const SCHEMA_SQL: &str = r#"
-- Version control
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at INTEGER NOT NULL
);

-- Application settings (hybrid: simple value + JSON)
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    json_value TEXT,
    updated_at INTEGER NOT NULL
);

-- Project registry with status tracking
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT UNIQUE NOT NULL,
    thumbnail TEXT,
    last_opened INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    is_pinned INTEGER DEFAULT 0,
    status TEXT DEFAULT 'valid' CHECK (status IN ('valid', 'missing', 'corrupted'))
);

CREATE INDEX IF NOT EXISTS idx_projects_last_opened ON projects(last_opened DESC);
CREATE INDEX IF NOT EXISTS idx_projects_pinned ON projects(is_pinned DESC);

-- Recipe index (logical paths, resolved at runtime)
CREATE TABLE IF NOT EXISTS recipe_index (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL CHECK (source IN ('builtin', 'user', 'marketplace')),
    path TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    icon TEXT,
    author TEXT,
    version INTEGER DEFAULT 1,
    cover TEXT,
    content_hash TEXT NOT NULL,
    indexed_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(source, path)
);

CREATE INDEX IF NOT EXISTS idx_recipe_source ON recipe_index(source);
CREATE INDEX IF NOT EXISTS idx_recipe_category ON recipe_index(category);
CREATE INDEX IF NOT EXISTS idx_recipe_name ON recipe_index(name);

-- Recipe tags (many-to-many)
CREATE TABLE IF NOT EXISTS recipe_tags (
    recipe_id TEXT NOT NULL REFERENCES recipe_index(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    PRIMARY KEY (recipe_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_tags_tag ON recipe_tags(tag);

-- FTS5 full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS recipe_fts USING fts5(
    id, name, description, category, author,
    content='recipe_index', content_rowid='rowid'
);

-- FTS sync triggers
CREATE TRIGGER IF NOT EXISTS recipe_fts_insert AFTER INSERT ON recipe_index BEGIN
    INSERT INTO recipe_fts(rowid, id, name, description, category, author)
    VALUES (NEW.rowid, NEW.id, NEW.name, NEW.description, NEW.category, NEW.author);
END;

CREATE TRIGGER IF NOT EXISTS recipe_fts_delete AFTER DELETE ON recipe_index BEGIN
    INSERT INTO recipe_fts(recipe_fts, rowid, id, name, description, category, author)
    VALUES ('delete', OLD.rowid, OLD.id, OLD.name, OLD.description, OLD.category, OLD.author);
END;

CREATE TRIGGER IF NOT EXISTS recipe_fts_update AFTER UPDATE ON recipe_index BEGIN
    INSERT INTO recipe_fts(recipe_fts, rowid, id, name, description, category, author)
    VALUES ('delete', OLD.rowid, OLD.id, OLD.name, OLD.description, OLD.category, OLD.author);
    INSERT INTO recipe_fts(rowid, id, name, description, category, author)
    VALUES (NEW.rowid, NEW.id, NEW.name, NEW.description, NEW.category, NEW.author);
END;
"#;

/// Get the path to the global database.
/// Returns `~/.synnia/synnia.db`
pub fn get_global_db_path() -> Result<PathBuf, AppError> {
    let home = dirs::home_dir()
        .ok_or_else(|| AppError::Unknown("Cannot determine home directory".to_string()))?;
    
    let synnia_dir = home.join(".synnia");
    Ok(synnia_dir.join("synnia.db"))
}

/// Initialize and open the global database.
/// Creates the database file and directory if they don't exist.
/// Enables WAL mode for concurrent access.
pub fn init_global_db() -> Result<Connection, AppError> {
    let db_path = get_global_db_path()?;
    
    // Ensure directory exists
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| AppError::Io(format!("Failed to create ~/.synnia: {}", e)))?;
    }
    
    // Open database
    let conn = Connection::open(&db_path)
        .map_err(|e| AppError::Database(format!("Failed to open global database: {}", e)))?;
    
    // Enable WAL mode for concurrent read/write
    conn.execute_batch("PRAGMA journal_mode=WAL;")
        .map_err(|e| AppError::Database(format!("Failed to enable WAL: {}", e)))?;
    
    // Set busy timeout (5 seconds) to handle lock contention
    conn.execute_batch("PRAGMA busy_timeout=5000;")
        .map_err(|e| AppError::Database(format!("Failed to set busy_timeout: {}", e)))?;
    
    // Enable foreign keys
    conn.execute_batch("PRAGMA foreign_keys=ON;")
        .map_err(|e| AppError::Database(format!("Failed to enable foreign keys: {}", e)))?;
    
    // Execute schema
    conn.execute_batch(SCHEMA_SQL)
        .map_err(|e| AppError::Database(format!("Failed to create schema: {}", e)))?;

    // Determine current schema version (if any)
    let current_version: Option<i32> = conn.query_row(
        "SELECT MAX(version) FROM schema_version",
        [],
        |row| row.get(0),
    ).ok();

    match current_version {
        None => {
            let now = chrono::Utc::now().timestamp();
            conn.execute(
                "INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (?1, ?2)",
                params![SCHEMA_VERSION, now]
            ).map_err(|e| AppError::Database(format!("Failed to record schema version: {}", e)))?;
            
            // Initialize default settings on first run
            init_default_settings(&conn)?;
        }
        Some(version) if version < SCHEMA_VERSION => {
            run_migrations(&conn, version)?;
            let now = chrono::Utc::now().timestamp();
            conn.execute(
                "INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (?1, ?2)",
                params![SCHEMA_VERSION, now]
            ).map_err(|e| AppError::Database(format!("Failed to update schema version: {}", e)))?;
        }
        _ => {}
    }
    
    Ok(conn)
}

/// Open an existing global database connection.
/// Does not create or initialize - use `init_global_db` for that.
pub fn open_global_db() -> Result<Connection, AppError> {
    let db_path = get_global_db_path()?;
    
    if !db_path.exists() {
        return Err(AppError::NotFound("Global database not initialized".to_string()));
    }
    
    let conn = Connection::open(&db_path)
        .map_err(|e| AppError::Database(format!("Failed to open global database: {}", e)))?;
    
    // Enable WAL mode
    conn.execute_batch("PRAGMA journal_mode=WAL;")
        .map_err(|e| AppError::Database(format!("Failed to enable WAL: {}", e)))?;
    
    conn.execute_batch("PRAGMA busy_timeout=5000;")
        .map_err(|e| AppError::Database(format!("Failed to set busy_timeout: {}", e)))?;
    
    conn.execute_batch("PRAGMA foreign_keys=ON;")
        .map_err(|e| AppError::Database(format!("Failed to enable foreign keys: {}", e)))?;

    // Ensure schema exists
    conn.execute_batch(SCHEMA_SQL)
        .map_err(|e| AppError::Database(format!("Failed to create schema: {}", e)))?;

    // Check and migrate schema version
    let current_version: Option<i32> = conn.query_row(
        "SELECT MAX(version) FROM schema_version",
        [],
        |row| row.get(0),
    ).ok();

    if let Some(version) = current_version {
        if version < SCHEMA_VERSION {
            run_migrations(&conn, version)?;
            let now = chrono::Utc::now().timestamp();
            conn.execute(
                "INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (?1, ?2)",
                params![SCHEMA_VERSION, now]
            ).map_err(|e| AppError::Database(format!("Failed to update schema version: {}", e)))?;
        }
    }
    
    Ok(conn)
}

// ============================================================================
// Migrations
// ============================================================================

fn run_migrations(conn: &Connection, from_version: i32) -> Result<(), AppError> {
    if from_version < 2 {
        conn.execute_batch(r#"
            DROP INDEX IF EXISTS idx_agent_messages_tool_call;
            DROP INDEX IF EXISTS idx_agent_messages_session;
            DROP INDEX IF EXISTS idx_agent_sessions_updated;
            DROP TABLE IF EXISTS agent_messages;
            DROP TABLE IF EXISTS agent_sessions;
        "#).map_err(|e| AppError::Database(format!("Failed to run migrations: {}", e)))?;
    }

    Ok(())
}
// ============================================================================
// Default Settings
// ============================================================================

/// Default directory for projects (relative to home)
pub const DEFAULT_PROJECTS_DIR: &str = "~/Documents/SynniaProjects";

/// Default directory for user recipes (relative to home)  
pub const DEFAULT_USER_RECIPES_DIR: &str = "~/.synnia/recipes";

/// Setting key for projects directory
pub const SETTING_PROJECTS_DIR: &str = "projects_directory";

/// Setting key for user recipes directory
pub const SETTING_USER_RECIPES_DIR: &str = "user_recipes_directory";

/// Initialize default settings on first run
fn init_default_settings(conn: &Connection) -> Result<(), AppError> {
    let now = chrono::Utc::now().timestamp();
    
    // Insert default settings (INSERT OR IGNORE to not overwrite)
    conn.execute(
        "INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES (?1, ?2, ?3)",
        params![SETTING_PROJECTS_DIR, DEFAULT_PROJECTS_DIR, now]
    ).map_err(|e| AppError::Database(format!("Failed to set default projects_directory: {}", e)))?;
    
    conn.execute(
        "INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES (?1, ?2, ?3)",
        params![SETTING_USER_RECIPES_DIR, DEFAULT_USER_RECIPES_DIR, now]
    ).map_err(|e| AppError::Database(format!("Failed to set default user_recipes_directory: {}", e)))?;
    
    log::info!("Initialized default settings: projects_directory={}, user_recipes_directory={}", 
        DEFAULT_PROJECTS_DIR, DEFAULT_USER_RECIPES_DIR);
    
    Ok(())
}

/// Expand ~ in path to actual home directory
pub fn expand_path(path: &str) -> PathBuf {
    if path.starts_with("~/") {
        dirs::home_dir()
            .map(|h| h.join(&path[2..]))
            .unwrap_or_else(|| PathBuf::from(path))
    } else if path == "~" {
        dirs::home_dir().unwrap_or_else(|| PathBuf::from(path))
    } else {
        PathBuf::from(path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    
    #[test]
    fn test_schema_creation() {
        // Use temp directory for test
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        
        let conn = Connection::open(&db_path).unwrap();
        conn.execute_batch(SCHEMA_SQL).unwrap();
        
        // Verify tables exist
        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table'")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        
        assert!(tables.contains(&"app_settings".to_string()));
        assert!(tables.contains(&"projects".to_string()));
        assert!(tables.contains(&"recipe_index".to_string()));
        assert!(tables.contains(&"recipe_tags".to_string()));
    }
}
