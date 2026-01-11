//! Execution logs operations for Recipe nodes.
//!
//! Provides CRUD operations for execution runs and log entries.

use rusqlite::params;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::services::io_sqlite::get_db_path;
use crate::services::database;

// ============================================
// Types
// ============================================

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionRun {
    pub id: String,
    pub node_id: String,
    #[ts(optional)]
    pub recipe_id: Option<String>,
    pub started_at: i64,
    #[ts(optional)]
    pub completed_at: Option<i64>,
    pub status: String,  // 'running' | 'success' | 'error'
    #[ts(optional)]
    pub model_id: Option<String>,
    #[ts(optional)]
    pub duration_ms: Option<i64>,
    #[ts(optional)]
    pub token_input: Option<i64>,
    #[ts(optional)]
    pub token_output: Option<i64>,
    #[ts(optional)]
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct LogEntry {
    pub id: i64,
    pub run_id: String,
    pub timestamp: i64,
    pub level: String, // 'debug' | 'info' | 'warn' | 'error'
    pub message: String,
    #[ts(optional)]
    pub data_json: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct NewLogEntry {
    pub run_id: String,
    pub timestamp: i64,
    pub level: String,
    pub message: String,
    #[ts(optional)]
    pub data_json: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct RunUpdate {
    #[ts(optional)]
    pub completed_at: Option<i64>,
    #[ts(optional)]
    pub status: Option<String>,
    #[ts(optional)]
    pub duration_ms: Option<i64>,
    #[ts(optional)]
    pub token_input: Option<i64>,
    #[ts(optional)]
    pub token_output: Option<i64>,
    #[ts(optional)]
    pub error_message: Option<String>,
}

// ============================================
// Commands
// ============================================

/// Get execution runs for a node
#[tauri::command]
pub async fn get_execution_runs(
    project_path: String,
    node_id: String,
    limit: Option<i32>,
) -> Result<Vec<ExecutionRun>, String> {
    let db_path = get_db_path(std::path::Path::new(&project_path));
    let conn = database::open_db(&db_path).map_err(|e| e.to_string())?;

    let limit_val = limit.unwrap_or(50);
    let mut stmt = conn
        .prepare(
            "SELECT id, node_id, recipe_id, started_at, completed_at, status, 
                    model_id, duration_ms, token_input, token_output, error_message
             FROM execution_runs 
             WHERE node_id = ? 
             ORDER BY started_at DESC
             LIMIT ?",
        )
        .map_err(|e| e.to_string())?;

    let runs = stmt
        .query_map(params![node_id, limit_val], |row| {
            Ok(ExecutionRun {
                id: row.get(0)?,
                node_id: row.get(1)?,
                recipe_id: row.get(2)?,
                started_at: row.get(3)?,
                completed_at: row.get(4)?,
                status: row.get(5)?,
                model_id: row.get(6)?,
                duration_ms: row.get(7)?,
                token_input: row.get(8)?,
                token_output: row.get(9)?,
                error_message: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(runs)
}

/// Create a new execution run
#[tauri::command]
pub async fn create_execution_run(
    project_path: String,
    run: ExecutionRun,
) -> Result<String, String> {
    let db_path = get_db_path(std::path::Path::new(&project_path));
    let conn = database::open_db(&db_path).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO execution_runs (id, node_id, recipe_id, started_at, completed_at, status, model_id, duration_ms, token_input, token_output, error_message)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            run.id,
            run.node_id,
            run.recipe_id,
            run.started_at,
            run.completed_at,
            run.status,
            run.model_id,
            run.duration_ms,
            run.token_input,
            run.token_output,
            run.error_message,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(run.id)
}

/// Update an execution run
#[tauri::command]
pub async fn update_execution_run(
    project_path: String,
    run_id: String,
    updates: RunUpdate,
) -> Result<(), String> {
    let db_path = get_db_path(std::path::Path::new(&project_path));
    let conn = database::open_db(&db_path).map_err(|e| e.to_string())?;

    // Build dynamic update query
    let mut set_parts = Vec::new();
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(v) = updates.completed_at {
        set_parts.push("completed_at = ?");
        params_vec.push(Box::new(v));
    }
    if let Some(v) = &updates.status {
        set_parts.push("status = ?");
        params_vec.push(Box::new(v.clone()));
    }
    if let Some(v) = updates.duration_ms {
        set_parts.push("duration_ms = ?");
        params_vec.push(Box::new(v));
    }
    if let Some(v) = updates.token_input {
        set_parts.push("token_input = ?");
        params_vec.push(Box::new(v));
    }
    if let Some(v) = updates.token_output {
        set_parts.push("token_output = ?");
        params_vec.push(Box::new(v));
    }
    if let Some(v) = &updates.error_message {
        set_parts.push("error_message = ?");
        params_vec.push(Box::new(v.clone()));
    }

    if set_parts.is_empty() {
        return Ok(());
    }

    params_vec.push(Box::new(run_id));

    let sql = format!(
        "UPDATE execution_runs SET {} WHERE id = ?",
        set_parts.join(", ")
    );

    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, params_refs.as_slice())
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Append a log entry
#[tauri::command]
pub async fn append_log_entry(
    project_path: String,
    entry: NewLogEntry,
) -> Result<i64, String> {
    let db_path = get_db_path(std::path::Path::new(&project_path));
    let conn = database::open_db(&db_path).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO log_entries (run_id, timestamp, level, message, data_json)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            entry.run_id,
            entry.timestamp,
            entry.level,
            entry.message,
            entry.data_json,
        ],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    Ok(id)
}

/// Get log entries for a run
#[tauri::command]
pub async fn get_log_entries(
    project_path: String,
    run_id: String,
) -> Result<Vec<LogEntry>, String> {
    let db_path = get_db_path(std::path::Path::new(&project_path));
    let conn = database::open_db(&db_path).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, run_id, timestamp, level, message, data_json
             FROM log_entries 
             WHERE run_id = ? 
             ORDER BY timestamp ASC",
        )
        .map_err(|e| e.to_string())?;

    let entries = stmt
        .query_map(params![run_id], |row| {
            Ok(LogEntry {
                id: row.get(0)?,
                run_id: row.get(1)?,
                timestamp: row.get(2)?,
                level: row.get(3)?,
                message: row.get(4)?,
                data_json: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(entries)
}

/// Clear execution logs for a node
#[tauri::command]
pub async fn clear_execution_logs(
    project_path: String,
    node_id: Option<String>,
) -> Result<(), String> {
    let db_path = get_db_path(std::path::Path::new(&project_path));
    let conn = database::open_db(&db_path).map_err(|e| e.to_string())?;

    if let Some(nid) = node_id {
        // Delete log entries first (foreign key constraint)
        conn.execute(
            "DELETE FROM log_entries WHERE run_id IN (SELECT id FROM execution_runs WHERE node_id = ?)",
            params![nid],
        )
        .map_err(|e| e.to_string())?;

        conn.execute("DELETE FROM execution_runs WHERE node_id = ?", params![nid])
            .map_err(|e| e.to_string())?;
    } else {
        // Clear all
        conn.execute("DELETE FROM log_entries", [])
            .map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM execution_runs", [])
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}
