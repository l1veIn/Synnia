use std::sync::Mutex;
use crate::db::SynniaDB;
use crate::error::AppError;

// Simple state to hold the connection. 
pub struct AppState {
    pub db: Mutex<Option<SynniaDB>>,
    pub current_project_path: Mutex<Option<String>>,
}

// Helper to get DB with error handling
impl AppState {
    pub fn get_db<F, T>(&self, f: F) -> Result<T, AppError>
    where
        F: FnOnce(&SynniaDB) -> Result<T, AppError>,
    {
        let db_guard = self.db.lock().map_err(|_| AppError::Unknown("DB Lock Poisoned".to_string()))?;
        match &*db_guard {
            Some(db) => f(db),
            None => Err(AppError::ProjectNotLoaded),
        }
    }
}
