//! Application state.
//!
//! Contains shared state that is accessible across all Tauri commands.

use std::sync::{Arc, Mutex};
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

/// Application state shared between Tauri commands and the file server.
pub struct AppState {
    /// Path to the currently loaded project (shared with Actix file server)
    pub current_project_path: Arc<Mutex<Option<String>>>,
    /// Port the local file server is running on
    pub server_port: u16,
    /// Global SurrealDB connection (namespace: synnia, db: global)
    pub global_db: Surreal<Db>,
    /// Project-specific SurrealDB connection (namespace: synnia, db: project_<id>)
    pub project_db: Mutex<Option<Surreal<Db>>>,
}
