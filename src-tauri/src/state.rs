use std::sync::Mutex;

// Simple state to hold the connection. 
pub struct AppState {
    // Removed DB
    pub current_project_path: Mutex<Option<String>>,
}