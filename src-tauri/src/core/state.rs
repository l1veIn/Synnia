//! Application state.
//!
//! Contains shared state that is accessible across all Tauri commands.

use std::sync::{Arc, Mutex};
use crate::features::agent::AgentState;

/// Application state shared between Tauri commands and the file server.
pub struct AppState {
    /// Path to the currently loaded project (shared with Actix file server)
    pub current_project_path: Arc<Mutex<Option<String>>>,
    /// Port the local file server is running on
    pub server_port: u16,
    /// Global agent state for managing chat sessions
    pub agent_state: Arc<Mutex<AgentState>>,
}
