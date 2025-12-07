use tauri::{State, AppHandle};
use crate::error::AppError;
use crate::AppState;
use std::path::PathBuf;

#[tauri::command]
pub fn import_file(file_path: String, state: State<AppState>, _app: AppHandle) -> Result<String, AppError> {
    let project_path_str = {
        let path_guard = state.current_project_path.lock().map_err(|_| AppError::Unknown("Path Lock Poisoned".to_string()))?;
        path_guard.clone().ok_or(AppError::ProjectNotLoaded)?
    };

    let project_path = PathBuf::from(project_path_str);

    // FIX: If project_path is a file (e.g. synnia.json), get its parent directory
    let project_root = if project_path.extension().is_some() {
        project_path.parent().unwrap_or(&project_path).to_path_buf()
    } else {
        project_path
    };
    
    println!("[Asset] Project Root: {:?}", project_root);

    let source_path = PathBuf::from(&file_path);
    if !source_path.exists() {
        return Err(AppError::NotFound(format!("File not found: {}", file_path)));
    }

    // Create assets directory if it doesn't exist
    let assets_dir = PathBuf::from(&project_root).join("assets");
    if !assets_dir.exists() {
        std::fs::create_dir_all(&assets_dir)?;
    }

    let ext = source_path.extension().and_then(|s| s.to_str()).unwrap_or("bin");
    let new_filename = format!("{}.{}", uuid::Uuid::new_v4(), ext);
    let relative_path = format!("assets/{}", new_filename);
    let target_path = PathBuf::from(&project_root).join(&relative_path);
    
    println!("[Asset] Copying from {:?} to {:?}", source_path, target_path);

    std::fs::copy(&source_path, &target_path)?;

    // Return only the relative path. The frontend will create the node.
    Ok(relative_path)
}

#[tauri::command]
pub fn save_processed_image(
    node_id: String,
    image_data: Vec<u8>, // Byte array
    state: State<AppState>,
    _app: AppHandle
) -> Result<String, AppError> {
    // 1. Get project root
    let project_path_str = {
        let path_guard = state.current_project_path.lock().map_err(|_| AppError::Unknown("Path Lock Poisoned".to_string()))?;
        path_guard.clone().ok_or(AppError::ProjectNotLoaded)?
    };
    
    let project_path = PathBuf::from(project_path_str);

    let project_root = if project_path.extension().is_some() {
        project_path.parent().unwrap_or(&project_path).to_path_buf()
    } else {
        project_path
    };
    
    let assets_dir = PathBuf::from(&project_root).join("assets");
    if !assets_dir.exists() {
        std::fs::create_dir_all(&assets_dir)?;
    }

    // 2. Generate new filename
    let filename = format!("{}_nobg_{}.png", node_id, chrono::Utc::now().timestamp());
    let file_path = assets_dir.join(&filename);

    // 3. Write file
    std::fs::write(&file_path, image_data)?;

    // 4. Return relative path
    let relative_path = format!("assets/{}", filename);
    
    // NO DB UPDATE. The frontend must update the node's data payload.

    Ok(relative_path)
}