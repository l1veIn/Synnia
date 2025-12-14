//! Asset version history management with CAS (Content Addressable Storage).
//!
//! Provides:
//! - Automatic snapshot creation on content change
//! - History retrieval with pagination
//! - Version restoration

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
/// Uses INSERT OR IGNORE to deduplicate by (asset_id, content_hash).
///
/// Returns true if a new snapshot was created, false if skipped (duplicate).
pub fn create_snapshot_if_changed(
    conn: &Connection,
    asset_id: &str,
    content_hash: &str,
    content_json: &str,
) -> SqliteResult<bool> {
    let now = chrono::Utc::now().timestamp_millis();
    
    // INSERT OR IGNORE will skip if (asset_id, content_hash) already exists
    let rows_affected = conn.execute(
        "INSERT OR IGNORE INTO asset_history (asset_id, content_hash, content_json, created_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![asset_id, content_hash, content_json, now],
    )?;
    
    // Cleanup old entries if we inserted a new one
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

/// Remove old history entries beyond MAX_HISTORY_PER_ASSET.
fn cleanup_old_history(conn: &Connection, asset_id: &str) -> SqliteResult<()> {
    // Delete entries that are older than the Nth newest entry
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
        "SELECT content_hash FROM assets WHERE id = ?1"
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
    use crate::services::database::init_db;
    use tempfile::tempdir;

    fn setup_test_db() -> Connection {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        init_db(&db_path).unwrap()
    }

    #[test]
    fn test_create_snapshot() {
        let conn = setup_test_db();
        
        // First snapshot should be created
        let created = create_snapshot_if_changed(
            &conn,
            "asset-1",
            "hash-abc",
            r#"{"content": "hello"}"#,
        ).unwrap();
        
        assert!(created, "First snapshot should be created");
        
        // Same hash should be deduplicated
        let created2 = create_snapshot_if_changed(
            &conn,
            "asset-1",
            "hash-abc",
            r#"{"content": "hello"}"#,
        ).unwrap();
        
        assert!(!created2, "Duplicate hash should be skipped");
        
        // Different hash should create new snapshot
        let created3 = create_snapshot_if_changed(
            &conn,
            "asset-1",
            "hash-xyz",
            r#"{"content": "world"}"#,
        ).unwrap();
        
        assert!(created3, "Different hash should create new snapshot");
    }

    #[test]
    fn test_get_history() {
        let conn = setup_test_db();
        
        // Create some snapshots
        for i in 0..3 {
            create_snapshot_if_changed(
                &conn,
                "asset-1",
                &format!("hash-{}", i),
                &format!(r#"{{"version": {}}}"#, i),
            ).unwrap();
        }
        
        let history = get_asset_history(&conn, "asset-1", None).unwrap();
        
        assert_eq!(history.len(), 3);
        // Verify all hashes are present
        let hashes: Vec<&str> = history.iter().map(|h| h.content_hash.as_str()).collect();
        assert!(hashes.contains(&"hash-0"));
        assert!(hashes.contains(&"hash-1"));
        assert!(hashes.contains(&"hash-2"));
    }

    #[test]
    fn test_cleanup_old_history() {
        let conn = setup_test_db();
        
        // Create more than MAX_HISTORY_PER_ASSET snapshots
        for i in 0..60 {
            create_snapshot_if_changed(
                &conn,
                "asset-1",
                &format!("hash-{}", i),
                &format!(r#"{{"version": {}}}"#, i),
            ).unwrap();
        }
        
        let count = count_history(&conn, "asset-1").unwrap();
        
        // Should be capped at MAX_HISTORY_PER_ASSET
        assert!(count <= MAX_HISTORY_PER_ASSET as i64);
    }
}
