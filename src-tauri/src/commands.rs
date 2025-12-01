use tauri::{State, AppHandle};
use std::sync::Mutex;
use crate::db::SynniaDB;
use crate::models::{AssetNode, AssetType, Edge};
use std::path::PathBuf;

// Simple state to hold the connection. 
// In a real app, we might want to handle "No Project Open" state better.
pub struct AppState {
    pub db: Mutex<Option<SynniaDB>>,
    pub current_project_path: Mutex<Option<String>>,
}

#[tauri::command]
pub fn init_project(path: String, state: State<AppState>) -> Result<String, String> {
    let db_path = PathBuf::from(&path).join(".synnia.db");
    
    // Ensure directory exists
    if !PathBuf::from(&path).exists() {
        std::fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    }

    // Init DB
    let db = SynniaDB::new(&db_path).map_err(|e| e.to_string())?;
    
    // Update State
    let mut db_guard = state.db.lock().unwrap();
    *db_guard = Some(db);
    
    let mut path_guard = state.current_project_path.lock().unwrap();
    *path_guard = Some(path.clone());

    Ok(format!("Project initialized at {}", path))
}

#[tauri::command]
pub fn create_node(
    project_id: String, 
    node_type: String, 
    x: f64, 
    y: f64, 
    state: State<AppState>
) -> Result<AssetNode, String> {
    let db_guard = state.db.lock().unwrap();
    
    if let Some(db) = &*db_guard {
        let asset_type = match node_type.as_str() {
            "Text" => AssetType::Text,
            "Prompt" => AssetType::Prompt,
            _ => AssetType::Image,
        };
        
        let node = db.create_asset(&project_id, asset_type, x, y).map_err(|e| e.to_string())?;
        Ok(node)
    } else {
        Err("No project currently open".to_string())
    }
}

#[tauri::command]
pub fn get_nodes(state: State<AppState>) -> Result<Vec<AssetNode>, String> {
    let db_guard = state.db.lock().unwrap();
    
    if let Some(db) = &*db_guard {
        let nodes = db.get_all_assets().map_err(|e| e.to_string())?;
        Ok(nodes)
    } else {
        Err("No project currently open".to_string())
    }
}

#[tauri::command]
pub fn create_edge(source_id: String, target_id: String, state: State<AppState>) -> Result<Edge, String> {
    let db_guard = state.db.lock().unwrap();
    
    if let Some(db) = &*db_guard {
        let edge = db.create_edge(&source_id, &target_id).map_err(|e| e.to_string())?;
        Ok(edge)
    } else {
        Err("No project currently open".to_string())
    }
}

#[tauri::command]
pub fn get_edges(state: State<AppState>) -> Result<Vec<Edge>, String> {
    let db_guard = state.db.lock().unwrap();
    
    if let Some(db) = &*db_guard {
        let edges = db.get_all_edges().map_err(|e| e.to_string())?;
        Ok(edges)
    } else {
        Err("No project currently open".to_string())
    }
}

#[tauri::command]
pub fn update_node_pos(id: String, x: f64, y: f64, state: State<AppState>) -> Result<(), String> {
    let db_guard = state.db.lock().unwrap();
    
    if let Some(db) = &*db_guard {
        db.update_asset_position(&id, x, y).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("No project currently open".to_string())
    }
}

#[tauri::command]
pub fn reset_project(state: State<AppState>) -> Result<(), String> {
    let db_guard = state.db.lock().unwrap();
    
    if let Some(db) = &*db_guard {
        db.clear_all_data().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("No project currently open".to_string())
    }
}
