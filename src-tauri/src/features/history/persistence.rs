//! History persistence layer.
//!
//! Asset version history management with CAS (Content Addressable Storage).

use rusqlite::{Connection, Result as SqliteResult, params};
use serde::{Deserialize, Serialize};

/// Maximum number of history entries to keep per asset
const MAX_HISTORY_PER_ASSET: i32 = 50;

/// A single history entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetHistoryEntry {
    pub id: i64,
    pub asset_id: String,
    pub content_hash: String,
    pub content_json: String,
    pub created_at: i64,
}

/// Create a history snapshot if the content hash has changed.
pub fn create_snapshot_if_changed(
    conn: &Connection,
    asset_id: &str,
    content_hash: &str,
    content_json: &str,
) -> SqliteResult<bool> {
    let now = chrono::Utc::now().timestamp_millis();
    
    let rows_affected = conn.execute(
        "INSERT OR IGNORE INTO asset_history (asset_id, content_hash, content_json, created_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![asset_id, content_hash, content_json, now],
    )?;
    
    if rows_affected > 0 {
        cleanup_old_history(conn, asset_id)?;
    }
    
    Ok(rows_affected > 0)
}

/// Get history entries for an asset, ordered by newest first.
pub fn get_asset_history(
    conn: &Connection,
    asset_id: &str,
    limit: Option<i32>,
) -> SqliteResult<Vec<AssetHistoryEntry>> {
    let limit = limit.unwrap_or(50);
    
    let mut stmt = conn.prepare(
        "SELECT id, asset_id, content_hash, content_json, created_at
         FROM asset_history
         WHERE asset_id = ?1
         ORDER BY created_at DESC
         LIMIT ?2"
    )?;
    
    let entries = stmt.query_map(params![asset_id, limit], |row| {
        Ok(AssetHistoryEntry {
            id: row.get(0)?,
            asset_id: row.get(1)?,
            content_hash: row.get(2)?,
            content_json: row.get(3)?,
            created_at: row.get(4)?,
        })
    })?;
    
    entries.collect()
}

/// Get a specific history entry by ID.
pub fn get_history_entry(conn: &Connection, history_id: i64) -> SqliteResult<Option<AssetHistoryEntry>> {
    let mut stmt = conn.prepare(
        "SELECT id, asset_id, content_hash, content_json, created_at
         FROM asset_history
         WHERE id = ?1"
    )?;
    
    let mut rows = stmt.query(params![history_id])?;
    
    if let Some(row) = rows.next()? {
        Ok(Some(AssetHistoryEntry {
            id: row.get(0)?,
            asset_id: row.get(1)?,
            content_hash: row.get(2)?,
            content_json: row.get(3)?,
            created_at: row.get(4)?,
        }))
    } else {
        Ok(None)
    }
}

fn cleanup_old_history(conn: &Connection, asset_id: &str) -> SqliteResult<()> {
    conn.execute(
        "DELETE FROM asset_history
         WHERE asset_id = ?1
         AND id NOT IN (
             SELECT id FROM asset_history
             WHERE asset_id = ?1
             ORDER BY created_at DESC
             LIMIT ?2
         )",
        params![asset_id, MAX_HISTORY_PER_ASSET],
    )?;
    
    Ok(())
}

/// Get the current content hash for an asset.
pub fn get_current_hash(conn: &Connection, asset_id: &str) -> SqliteResult<Option<String>> {
    let mut stmt = conn.prepare(
        "SELECT value_hash FROM assets WHERE id = ?1"
    )?;
    
    let mut rows = stmt.query(params![asset_id])?;
    
    if let Some(row) = rows.next()? {
        Ok(Some(row.get(0)?))
    } else {
        Ok(None)
    }
}

/// Count the number of history entries for an asset.
pub fn count_history(conn: &Connection, asset_id: &str) -> SqliteResult<i64> {
    conn.query_row(
        "SELECT COUNT(*) FROM asset_history WHERE asset_id = ?1",
        params![asset_id],
        |row| row.get(0),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::database::init_db;
    use tempfile::tempdir;

    fn setup_test_db() -> Connection {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        init_db(&db_path).unwrap()
    }

    #[test]
    fn test_create_snapshot() {
        let conn = setup_test_db();
        
        let created = create_snapshot_if_changed(
            &conn,
            "asset-1",
            "hash-abc",
            r#"{"content": "hello"}"#,
        ).unwrap();
        
        assert!(created);
        
        let created2 = create_snapshot_if_changed(
            &conn,
            "asset-1",
            "hash-abc",
            r#"{"content": "hello"}"#,
        ).unwrap();
        
        assert!(!created2);
    }
}
