use tauri::{State, AppHandle, Emitter};
use crate::error::AppError;
use crate::models::{AssetNode, AssetType, Edge, AssetNodeWithData};
use crate::AppState;

#[tauri::command]
pub fn create_node(
    project_id: String, 
    node_type: String, 
    x: f64, 
    y: f64, 
    payload: Option<String>, // New optional param
    state: State<AppState>,
    app: AppHandle
) -> Result<AssetNode, AppError> {
    state.get_db(|db| {
        let asset_type = match node_type.as_str() {
            "Text" => AssetType::Text,
            "Prompt" => AssetType::Prompt,
            _ => AssetType::Image,
        };
        
        let final_payload = if let Some(p) = payload {
            p
        } else {
            match asset_type {
                AssetType::Text => "New text note".to_string(),
                AssetType::Prompt => "Enter prompt here...".to_string(),
                _ => "".to_string()
            }
        };

        let node = db.create_asset_with_payload(&project_id, asset_type, x, y, &final_payload)?;
        
        app.emit("graph:updated", ()).map_err(|e| AppError::Unknown(e.to_string()))?;
        
        Ok(node)
    })
}

#[tauri::command]
pub fn restore_node(
    id: String,
    project_id: String,
    node_type: String,
    x: f64, 
    y: f64,
    width: Option<f64>,
    height: Option<f64>,
    payload: String,
    state: State<AppState>,
    app: AppHandle
) -> Result<(), AppError> {
    state.get_db(|db| {
        let asset_type = match node_type.as_str() {
            "Text" => AssetType::Text,
            "Prompt" => AssetType::Prompt,
            "Image" => AssetType::Image,
            _ => AssetType::Other,
        };
        
        db.restore_asset(&id, &project_id, asset_type, x, y, width, height, &payload)?;
        app.emit("graph:updated", ()).map_err(|e| AppError::Unknown(e.to_string()))?;
        Ok(())
    })
}

#[tauri::command]
pub fn get_nodes(state: State<AppState>) -> Result<Vec<AssetNodeWithData>, AppError> {
    state.get_db(|db| {
        Ok(db.get_nodes_with_data()?)
    })
}

#[tauri::command]
pub fn delete_node(id: String, state: State<AppState>, app: AppHandle) -> Result<(), AppError> {
    state.get_db(|db| {
        db.delete_asset(&id)?;
        app.emit("graph:updated", ()).map_err(|e| AppError::Unknown(e.to_string()))?;
        Ok(())
    })
}

#[tauri::command]
pub fn update_node_pos(id: String, x: f64, y: f64, state: State<AppState>, app: AppHandle) -> Result<(), AppError> {
    state.get_db(|db| {
        db.update_asset_position(&id, x, y)?;
        app.emit("graph:updated", ()).map_err(|e| AppError::Unknown(e.to_string()))?;
        Ok(())
    })
}

#[tauri::command]
pub fn update_node_size(id: String, width: f64, height: f64, state: State<AppState>, app: AppHandle) -> Result<(), AppError> {
    state.get_db(|db| {
        db.update_asset_size(&id, width, height)?;
        app.emit("graph:updated", ()).map_err(|e| AppError::Unknown(e.to_string()))?;
        Ok(())
    })
}

#[tauri::command]
pub fn rename_node(id: String, new_name: String, state: State<AppState>, app: AppHandle) -> Result<(), AppError> {
    state.get_db(|db| {
        db.update_asset_label(&id, &new_name)?;
        app.emit("graph:updated", ()).map_err(|e| AppError::Unknown(e.to_string()))?;
        Ok(())
    })
}

#[tauri::command]
pub fn create_edge(source_id: String, target_id: String, state: State<AppState>, app: AppHandle) -> Result<Edge, AppError> {
    state.get_db(|db| {
        let edge = db.create_edge(&source_id, &target_id)?;
        app.emit("graph:updated", ()).map_err(|e| AppError::Unknown(e.to_string()))?;
        Ok(edge)
    })
}

#[tauri::command]
pub fn get_edges(state: State<AppState>) -> Result<Vec<Edge>, AppError> {
    state.get_db(|db| {
        Ok(db.get_all_edges()?)
    })
}

#[tauri::command]
pub fn delete_edge(id: String, state: State<AppState>, app: AppHandle) -> Result<(), AppError> {
    state.get_db(|db| {
        db.delete_edge(&id)?;
        app.emit("graph:updated", ()).map_err(|e| AppError::Unknown(e.to_string()))?;
        Ok(())
    })
}

#[tauri::command]
pub fn restore_edge(id: String, source_id: String, target_id: String, state: State<AppState>, app: AppHandle) -> Result<(), AppError> {
    state.get_db(|db| {
        db.restore_edge(&id, &source_id, &target_id)?;
        app.emit("graph:updated", ()).map_err(|e| AppError::Unknown(e.to_string()))?;
        Ok(())
    })
}
