use std::sync::{Arc, Mutex};

// Simple state to hold the connection. 
pub struct AppState {
    // Shared with Actix Server
    pub current_project_path: Arc<Mutex<Option<String>>>,
    pub server_port: u16,
}