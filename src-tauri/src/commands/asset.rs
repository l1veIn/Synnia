use tauri::{State, AppHandle, Emitter};
use crate::error::AppError;
use crate::models::{AssetNode, AssetType};
use crate::AppState;
use std::path::PathBuf;

#[tauri::command]
pub fn import_file(file_path: String, state: State<AppState>, app: AppHandle) -> Result<AssetNode, AppError> {
    let (project_root, db_available) = {
        let db_guard = state.db.lock().map_err(|_| AppError::Unknown("DB Lock Poisoned".to_string()))?;
        let path_guard = state.current_project_path.lock().map_err(|_| AppError::Unknown("Path Lock Poisoned".to_string()))?;
        
        if let (Some(_), Some(path)) = (db_guard.as_ref(), path_guard.as_ref()) {
            (path.clone(), true)
        } else {
            ("".to_string(), false)
        }
    };

    if !db_available {
        return Err(AppError::ProjectNotLoaded);
    }

    let source_path = PathBuf::from(&file_path);
    if !source_path.exists() {
        return Err(AppError::NotFound(format!("File not found: {}", file_path)));
    }

    let ext = source_path.extension().and_then(|s| s.to_str()).unwrap_or("bin");
    let new_filename = format!("{}.{}", uuid::Uuid::new_v4(), ext);
    let relative_path = format!("assets/{}", new_filename);
    let target_path = PathBuf::from(&project_root).join(&relative_path);

    std::fs::copy(&source_path, &target_path)?;

    state.get_db(|db| {
        let node = db.create_asset_with_payload(
            "demo", 
            AssetType::Image,
            100.0,
            100.0,
            &relative_path
        )?;
        
        app.emit("graph:updated", ()).map_err(|e| AppError::Unknown(e.to_string()))?;
        Ok(node)
    })
}

#[tauri::command]
pub fn save_processed_image(
    node_id: String,
    image_data: Vec<u8>, // Byte array
    state: State<AppState>,
    app: AppHandle
) -> Result<String, AppError> {
    // 1. Get project root
    let project_root = {
        let path_guard = state.current_project_path.lock().map_err(|_| AppError::Unknown("Path Lock Poisoned".to_string()))?;
        path_guard.clone().ok_or(AppError::ProjectNotLoaded)?
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
    
    // 5. Update DB payload for the node
    state.get_db(|db| {
        db.update_asset_payload(&node_id, &relative_path)?;
        Ok(())
    })?;

    // 6. Emit update
    app.emit("graph:updated", ()).map_err(|e| AppError::Unknown(e.to_string()))?;

    Ok(relative_path)
}
