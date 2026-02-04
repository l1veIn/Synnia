//! Project management Tauri commands.

use tauri::{State, AppHandle, Emitter};
use std::path::PathBuf;
use std::io::Cursor;
use serde::{Deserialize, Serialize};
use image::GenericImageView;

use crate::core::{AppError, AppState};
use crate::domain::SynniaProject;
use crate::global::{database, projects, settings};
use super::persistence;

// ============================================
// Types for frontend compatibility
// ============================================

/// Project info for frontend (matches old RecentProject format)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentProjectInfo {
    pub name: String,
    pub path: String,
    pub thumbnail: Option<String>, // Base64 data URL
    pub last_opened: String, // ISO string for frontend
    pub is_pinned: bool,
    pub status: String,
}

impl From<projects::ProjectInfo> for RecentProjectInfo {
    fn from(p: projects::ProjectInfo) -> Self {
        RecentProjectInfo {
            name: p.name,
            path: p.path,
            thumbnail: p.thumbnail,
            last_opened: chrono::DateTime::from_timestamp_millis(p.last_opened)
                .map(|dt| dt.to_rfc3339())
                .unwrap_or_default(),
            is_pinned: p.is_pinned,
            status: p.status.as_str().to_string(),
        }
    }
}

// ============================================
// Project List Commands
// ============================================

#[tauri::command]
pub fn get_recent_projects() -> Result<Vec<RecentProjectInfo>, AppError> {
    let conn = database::init_global_db()?;
    let projects_list = projects::list_projects(&conn, Some(20))?;
    Ok(projects_list.into_iter().map(Into::into).collect())
}

#[tauri::command]
pub fn get_default_projects_path(app: AppHandle) -> Result<String, AppError> {
    let conn = database::init_global_db()?;
    
    // Check for projects_directory setting first
    if let Some(path) = settings::get_setting(&conn, database::SETTING_PROJECTS_DIR)? {
        return Ok(database::expand_path(&path).to_string_lossy().to_string());
    }
    
    // Legacy: check for default_workspace
    if let Some(ws) = settings::get_setting(&conn, "default_workspace")? {
        return Ok(ws);
    }

    // Fallback: use default and save it
    let expanded = database::expand_path(database::DEFAULT_PROJECTS_DIR);
    if !expanded.exists() {
        std::fs::create_dir_all(&expanded)?;
    }
    Ok(expanded.to_string_lossy().to_string())
}

#[tauri::command]
pub fn set_default_projects_path(path: String) -> Result<(), AppError> {
    let conn = database::init_global_db()?;
    settings::set_setting(&conn, "default_workspace", &path)?;
    Ok(())
}

// ============================================
// Project Lifecycle Commands
// ============================================

#[tauri::command]
pub fn create_project(
    name: String, 
    parent_path: String, 
    state: State<AppState>, 
    app: AppHandle
) -> Result<String, AppError> {
    let safe_name: String = name.chars()
        .filter(|c| c.is_alphanumeric() || *c == ' ' || *c == '-' || *c == '_')
        .collect();
    let project_path = PathBuf::from(&parent_path).join(&safe_name);
    
    if project_path.exists() {
        return Err(AppError::Unknown(format!(
            "Project '{}' already exists in that location.", safe_name
        )));
    }

    init_project(project_path.to_string_lossy().to_string(), state, app)
}

#[tauri::command]
pub fn init_project(
    path: String, 
    state: State<AppState>, 
    app: AppHandle
) -> Result<String, AppError> {
    let project_path = PathBuf::from(&path);
    let assets_path = project_path.join("assets");
    
    if !project_path.exists() {
        std::fs::create_dir_all(&project_path)?;
    }

    if !assets_path.exists() {
        std::fs::create_dir_all(&assets_path)?;
    }

    let name = project_path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Untitled Project");
    
    persistence::init_project_sqlite(&project_path, name)?;
    
    // Update AppState
    let mut path_guard = state.current_project_path.lock()
        .map_err(|_| AppError::Unknown("Path Lock Poisoned".to_string()))?;
    *path_guard = Some(path.clone());

    // Register in global database
    let conn = database::init_global_db()?;
    projects::register_project(&conn, &path, name)?;
    
    app.emit("project:active", serde_json::json!({ "name": name }))
        .map_err(|e| AppError::Unknown(e.to_string()))?;

    Ok(format!("Project initialized at {}", path))
}

#[tauri::command]
pub fn load_project(
    path: String, 
    state: State<AppState>, 
    app: AppHandle
) -> Result<SynniaProject, AppError> {
    let project_path = PathBuf::from(&path);
    if !project_path.exists() {
        return Err(AppError::NotFound(format!("Project path not found: {}", path)));
    }

    let project = persistence::load_project_sqlite(&project_path)?;

    // Update AppState
    let mut path_guard = state.current_project_path.lock()
        .map_err(|_| AppError::Unknown("Path Lock Poisoned".to_string()))?;
    *path_guard = Some(path.clone());

    // Update last_opened in global database
    let conn = database::init_global_db()?;
    projects::register_project(&conn, &path, &project.meta.name)?;

    app.emit("project:active", serde_json::json!({ "name": project.meta.name }))
        .map_err(|e| AppError::Unknown(e.to_string()))?;

    Ok(project)
}

#[tauri::command]
pub fn save_project_autosave(
    project: SynniaProject, 
    state: State<AppState>
) -> Result<(), AppError> {
    let project_path_str = {
        let path_guard = state.current_project_path.lock()
            .map_err(|_| AppError::Unknown("Lock poisoned".to_string()))?;
        path_guard.clone().ok_or(AppError::ProjectNotLoaded)?
    };
    
    let project_path = PathBuf::from(project_path_str);
    persistence::save_project_sqlite(&project_path, &project)?;
    Ok(())
}

#[tauri::command]
pub fn save_project(
    project: SynniaProject, 
    state: State<AppState>
) -> Result<(), AppError> {
    let project_path_str = {
        let path_guard = state.current_project_path.lock()
            .map_err(|_| AppError::Unknown("Lock poisoned".to_string()))?;
        path_guard.clone().ok_or(AppError::ProjectNotLoaded)?
    };
    
    let project_path = PathBuf::from(project_path_str);
    persistence::save_project_sqlite(&project_path, &project)?;
    Ok(())
}

#[tauri::command]
pub fn get_current_project_path(state: State<AppState>) -> Result<String, AppError> {
    let path_guard = state.current_project_path.lock()
        .map_err(|_| AppError::Unknown("Path Lock Poisoned".to_string()))?;
    path_guard.clone().ok_or(AppError::ProjectNotLoaded)
}

#[tauri::command]
pub fn delete_project(
    path: String, 
    state: State<AppState>, 
) -> Result<(), AppError> {
    let path_buf = PathBuf::from(&path);
    
    if !path_buf.exists() {
        return Err(AppError::NotFound(format!("Path not found: {}", path)));
    }

    // Safety check
    let db_path = path_buf.join("synnia.db");
    let json_path = path_buf.join("synnia.json");
    if !db_path.exists() && !json_path.exists() {
        return Err(AppError::Validation(format!(
            "The directory '{}' does not appear to be a valid Synnia project", 
            path
        )));
    }

    // Close if active
    {
        let mut path_guard = state.current_project_path.lock()
            .map_err(|_| AppError::Unknown("Lock poisoned".to_string()))?;
        if let Some(current) = &*path_guard {
            if PathBuf::from(current) == path_buf {
                *path_guard = None;
            }
        }
    }

    std::fs::remove_dir_all(&path_buf)?;

    // Remove from global database
    let conn = database::init_global_db()?;
    projects::remove_project(&conn, &path)?;

    Ok(())
}

#[tauri::command]
pub fn rename_project(
    old_path: String, 
    new_name: String, 
    state: State<AppState>, 
) -> Result<String, AppError> {
    let old_path_buf = PathBuf::from(&old_path);
    if !old_path_buf.exists() {
        return Err(AppError::NotFound("Project path not found".to_string()));
    }

    let parent = old_path_buf.parent()
        .ok_or(AppError::Unknown("Invalid path".to_string()))?;
    let safe_name: String = new_name.chars()
        .filter(|c| c.is_alphanumeric() || *c == ' ' || *c == '-' || *c == '_')
        .collect();
    let new_path_buf = parent.join(&safe_name);

    if new_path_buf.exists() {
        return Err(AppError::Unknown("A project with that name already exists".to_string()));
    }

    // Close if active
    {
        let mut path_guard = state.current_project_path.lock()
            .map_err(|_| AppError::Unknown("Lock poisoned".to_string()))?;
        if let Some(current) = &*path_guard {
            if PathBuf::from(current) == old_path_buf {
                *path_guard = None;
            }
        }
    }

    std::fs::rename(&old_path_buf, &new_path_buf)?;

    // Update in global database
    let new_path_str = new_path_buf.to_string_lossy().to_string();
    let conn = database::init_global_db()?;
    projects::remove_project(&conn, &old_path)?;
    projects::register_project(&conn, &new_path_str, &safe_name)?;

    Ok(new_path_str)
}

#[tauri::command]
pub fn reset_project(
    state: State<AppState>, 
) -> Result<SynniaProject, AppError> {
    let project_path_str = {
        let path_guard = state.current_project_path.lock()
            .map_err(|_| AppError::Unknown("Lock poisoned".to_string()))?;
        path_guard.clone().ok_or(AppError::ProjectNotLoaded)?
    };
    
    let project_path = PathBuf::from(&project_path_str);
    
    let name = project_path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Untitled Project");
    
    let project = persistence::init_project_sqlite(&project_path, name)?;
    
    Ok(project)
}

#[tauri::command]
pub fn open_in_browser(url: String) -> Result<(), AppError> {
    #[cfg(target_os = "windows")]
    std::process::Command::new("cmd")
        .args(["/c", "start", &url])
        .spawn()
        .map_err(|e| AppError::Unknown(e.to_string()))?;

    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .arg(&url)
        .spawn()
        .map_err(|e| AppError::Unknown(e.to_string()))?;

    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open")
        .arg(&url)
        .spawn()
        .map_err(|e| AppError::Unknown(e.to_string()))?;

    Ok(())
}

#[tauri::command]
pub async fn set_thumbnail(
    image_relative_path: String, 
    state: State<'_, AppState>
) -> Result<(), AppError> {
    let project_path = {
        let path_guard = state.current_project_path.lock()
            .map_err(|_| AppError::Unknown("Lock poisoned".to_string()))?;
        path_guard.clone().ok_or(AppError::ProjectNotLoaded)?
    };

    let project_path_clone = project_path.clone();
    let image_path_clone = image_relative_path.clone();

    tokio::task::spawn_blocking(move || {
        let src = PathBuf::from(&project_path_clone).join(&image_path_clone);
        
        if !src.exists() {
            return Err(AppError::NotFound("Image file not found".to_string()));
        }

        // Load the image
        let img = image::open(&src)
            .map_err(|e| AppError::Unknown(format!("Failed to open image: {}", e)))?;
        
        // Resize to 500x500 (cover mode - crop to square then resize)
        let (w, h) = img.dimensions();
        let min_dim = w.min(h);
        let cropped = img.crop_imm(
            (w - min_dim) / 2,
            (h - min_dim) / 2,
            min_dim,
            min_dim
        );
        let resized = cropped.resize_exact(500, 500, image::imageops::FilterType::Lanczos3);
        
        // Encode to PNG and then base64
        let mut buffer = Cursor::new(Vec::new());
        resized.write_to(&mut buffer, image::ImageFormat::Png)
            .map_err(|e| AppError::Unknown(format!("Failed to encode image: {}", e)))?;
        
        let base64_data = base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            buffer.into_inner()
        );
        let data_url = format!("data:image/png;base64,{}", base64_data);
        
        // Save to global database
        let conn = database::init_global_db()?;
        projects::update_thumbnail(&conn, &project_path_clone, Some(&data_url))?;
        
        Ok(())
    }).await.map_err(|e| AppError::Unknown(format!("Task panicked: {}", e)))?
}

// ============================================
// Project Validation (for startup)
// ============================================

#[tauri::command]
pub fn validate_projects() -> Result<projects::ValidateResult, AppError> {
    let conn = database::init_global_db()?;
    projects::validate_projects(&conn)
}
