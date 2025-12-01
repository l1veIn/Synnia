use tauri::{State, AppHandle, Emitter};
use tauri::Manager;
use std::path::PathBuf;
use crate::db::SynniaDB;
use crate::error::AppError;
use crate::config::{GlobalConfig, RecentProject};
use crate::AppState; // Ensure AppState is visible

#[tauri::command]
pub fn get_recent_projects(app: AppHandle) -> Result<Vec<RecentProject>, AppError> {
    let config = GlobalConfig::load(&app);
    Ok(config.recent_projects)
}

#[tauri::command]
pub fn get_default_projects_path(app: AppHandle) -> Result<String, AppError> {
    let config = GlobalConfig::load(&app);
    
    if let Some(ws) = config.default_workspace {
        return Ok(ws);
    }

    let docs_dir = app.path().document_dir().map_err(|_| AppError::Unknown("Could not find documents dir".to_string()))?;
    let default_path = docs_dir.join("SynniaProjects"); 
    if !default_path.exists() {
        std::fs::create_dir_all(&default_path)?;
    }
    Ok(default_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn set_default_projects_path(path: String, app: AppHandle) -> Result<(), AppError> {
    let mut config = GlobalConfig::load(&app);
    config.set_workspace(path);
    config.save(&app).map_err(|e| AppError::Unknown(e))?;
    Ok(())
}

#[tauri::command]
pub fn create_project(name: String, parent_path: String, state: State<AppState>, app: AppHandle) -> Result<String, AppError> {
    let safe_name: String = name.chars().filter(|c| c.is_alphanumeric() || *c == ' ' || *c == '-' || *c == '_').collect();
    let project_path = PathBuf::from(&parent_path).join(&safe_name);
    
    if project_path.exists() {
        return Err(AppError::Unknown(format!("Project '{}' already exists in that location.", safe_name)));
    }

    init_project(project_path.to_string_lossy().to_string(), state, app)
}

#[tauri::command]
pub fn init_project(path: String, state: State<AppState>, app: AppHandle) -> Result<String, AppError> {
    let project_path = PathBuf::from(&path);
    let db_path = project_path.join(".synnia.db");
    let assets_path = project_path.join("assets");
    
    if !project_path.exists() {
        std::fs::create_dir_all(&project_path)?;
    }

    if !assets_path.exists() {
        std::fs::create_dir_all(&assets_path)?;
    }

    let db = SynniaDB::new(&db_path)?;
    
    let mut db_guard = state.db.lock().map_err(|_| AppError::Unknown("DB Lock Poisoned".to_string()))?;
    *db_guard = Some(db);
    
    let mut path_guard = state.current_project_path.lock().map_err(|_| AppError::Unknown("Path Lock Poisoned".to_string()))?;
    *path_guard = Some(path.clone());

    let mut config = GlobalConfig::load(&app);
    let name = project_path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Untitled Project")
        .to_string();
    
    config.add_recent(name, path.clone());
    if let Err(e) = config.save(&app) {
        println!("Failed to save global config: {}", e);
    }

    Ok(format!("Project initialized at {}", path))
}

#[tauri::command]
pub fn get_current_project_path(state: State<AppState>) -> Result<String, AppError> {
    let path_guard = state.current_project_path.lock().map_err(|_| AppError::Unknown("Path Lock Poisoned".to_string()))?;
    path_guard.clone().ok_or(AppError::ProjectNotLoaded)
}

#[tauri::command]
pub fn delete_project(path: String, state: State<AppState>, app: AppHandle) -> Result<(), AppError> {
    let path_buf = PathBuf::from(&path);
    
    if !path_buf.exists() {
        return Err(AppError::NotFound(format!("Path not found: {}", path)));
    }

    // SAFETY CHECK: Ensure this is actually a Synnia project
    // Check for the existence of the database file
    let db_path = path_buf.join(".synnia.db");
    if !db_path.exists() {
        return Err(AppError::Unknown(format!(
            "Safety Guard: The directory '{}' does not appear to be a valid Synnia project (missing .synnia.db). Deletion aborted to protect your data.", 
            path
        )));
    }

    // Check if this is the active project and close it if so
    {
        let mut path_guard = state.current_project_path.lock().map_err(|_| AppError::Unknown("Lock poisoned".to_string()))?;
        let should_close = if let Some(current) = &*path_guard {
            PathBuf::from(current) == path_buf
        } else {
            false
        };

        if should_close {
            let mut db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock poisoned".to_string()))?;
            *db_guard = None; // Drop connection
            *path_guard = None;
        }
    }

    // Remove from FS
    std::fs::remove_dir_all(&path_buf).map_err(|e| AppError::Io(e.to_string()))?;

    // Remove from Config (Recent Projects)
    let mut config = GlobalConfig::load(&app);
    config.recent_projects.retain(|p| p.path != path);
    config.save(&app).map_err(|e| AppError::Unknown(e))?;

    Ok(())
}

#[tauri::command]
pub fn rename_project(old_path: String, new_name: String, state: State<AppState>, app: AppHandle) -> Result<String, AppError> {
    let old_path_buf = PathBuf::from(&old_path);
    if !old_path_buf.exists() {
        return Err(AppError::NotFound("Project path not found".to_string()));
    }

    let parent = old_path_buf.parent().ok_or(AppError::Unknown("Invalid path".to_string()))?;
    let safe_name: String = new_name.chars().filter(|c| c.is_alphanumeric() || *c == ' ' || *c == '-' || *c == '_').collect();
    let new_path_buf = parent.join(&safe_name);

    if new_path_buf.exists() {
        return Err(AppError::Unknown("A project with that name already exists".to_string()));
    }

    // Close Lock if active
    {
        let mut path_guard = state.current_project_path.lock().map_err(|_| AppError::Unknown("Lock poisoned".to_string()))?;
        let should_close = if let Some(current) = &*path_guard {
            PathBuf::from(current) == old_path_buf
        } else {
            false
        };

        if should_close {
            let mut db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock poisoned".to_string()))?;
            *db_guard = None;
            *path_guard = None;
        }
    }

    // Rename
    std::fs::rename(&old_path_buf, &new_path_buf).map_err(|e| AppError::Io(e.to_string()))?;

    // Update Config
    let new_path_str = new_path_buf.to_string_lossy().to_string();
    let mut config = GlobalConfig::load(&app);
    
    if let Some(project) = config.recent_projects.iter_mut().find(|p| p.path == old_path) {
        project.path = new_path_str.clone();
        project.name = safe_name;
    }
    config.save(&app).map_err(|e| AppError::Unknown(e))?;

    Ok(new_path_str)
}

#[tauri::command]
pub fn reset_project(state: State<AppState>, app: AppHandle) -> Result<(), AppError> {
    state.get_db(|db| {
        db.clear_all_data()?;
        app.emit("graph:updated", ()).map_err(|e| AppError::Unknown(e.to_string()))?;
        Ok(())
    })
}

#[tauri::command]
pub fn open_in_browser(url: String) -> Result<(), AppError> {
    #[cfg(target_os = "windows")]
    std::process::Command::new("cmd").args(["/c", "start", &url]).spawn().map_err(|e| AppError::Unknown(e.to_string()))?;

    #[cfg(target_os = "macos")]
    std::process::Command::new("open").arg(&url).spawn().map_err(|e| AppError::Unknown(e.to_string()))?;

    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open").arg(&url).spawn().map_err(|e| AppError::Unknown(e.to_string()))?;

    Ok(())
}

#[tauri::command]
pub fn set_thumbnail(node_id: String, state: State<AppState>) -> Result<(), AppError> {
    // 1. Get Project Path
    let project_path = {
        let path_guard = state.current_project_path.lock().map_err(|_| AppError::Unknown("Lock poisoned".to_string()))?;
        path_guard.clone().ok_or(AppError::ProjectNotLoaded)?
    };

    // 2. Get Node Payload
    let payload = state.get_db(|db| {
        let nodes = db.get_nodes_with_data()?;
        let node = nodes.into_iter().find(|n| n.id == node_id)
            .ok_or(AppError::NotFound("Node not found".to_string()))?;
        Ok(node.payload)
    })?;

    // 3. Copy File
    if let Some(rel_path) = payload {
        let src = PathBuf::from(&project_path).join(&rel_path);
        let dest = PathBuf::from(&project_path).join("thumbnail.png");
        
        if src.exists() {
            std::fs::copy(src, dest).map_err(|e| AppError::Io(e.to_string()))?;
        } else {
            return Err(AppError::NotFound("Image file not found".to_string()));
        }
    } else {
        return Err(AppError::Unknown("Node has no image data".to_string()));
    }

    Ok(())
}
