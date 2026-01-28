//! Asset commands module.
//! 
//! Split into submodules for maintainability:
//! - `import`: Resource import commands (import_resource, batch_import_images)
//! - `query`: Asset query commands (get_media_assets)
//! - `delete`: Asset deletion commands (delete_media_asset, cleanup_orphan_assets)

pub mod import;
pub mod query;
pub mod delete;

use std::path::PathBuf;
use tauri::State;
use crate::core::{AppError, AppState};

// Re-export all public commands
pub use import::{import_resource, batch_import_images};
pub use query::get_media_assets;
pub use delete::{delete_media_asset, cleanup_orphan_assets};

/// Get the project root directory from state.
/// Shared helper used by all command submodules.
pub(crate) fn get_project_root(state: &State<AppState>) -> Result<PathBuf, AppError> {
    let project_path_str = {
        let path_guard = state.current_project_path.lock()
            .map_err(|_| AppError::Unknown("Path Lock Poisoned".to_string()))?;
        path_guard.clone().ok_or(AppError::ProjectNotLoaded)?
    };
    
    let project_path = PathBuf::from(project_path_str);
    
    if project_path.extension().is_some() {
        Ok(project_path.parent().unwrap_or(&project_path).to_path_buf())
    } else {
        Ok(project_path)
    }
}
