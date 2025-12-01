use tauri::{State, AppHandle, Emitter};
use tauri::Manager; // Import Manager trait
use std::path::PathBuf;
use crate::error::AppError;
use crate::models::{AgentDefinition, AssetType};
use crate::services::agent_service::{call_gemini_agent, GraphAction};
use crate::AppState;

// Helper to get agents directory
fn get_agents_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    let docs_dir = app.path().document_dir().map_err(|_| AppError::Unknown("No documents directory found".into()))?;
    let agents_dir = docs_dir.join("Synnia").join("Agents");
    if !agents_dir.exists() {
        std::fs::create_dir_all(&agents_dir).map_err(|e| AppError::Io(e.to_string()))?;
    }
    Ok(agents_dir)
}

#[tauri::command]
pub fn get_agents(app: AppHandle) -> Result<Vec<AgentDefinition>, AppError> {
    let mut agents = Vec::new();
    
    // Scan Local Files
    if let Ok(dir) = get_agents_dir(&app) {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                // Only read .json files
                if path.extension().and_then(|s| s.to_str()) == Some("json") {
                    if let Ok(content) = std::fs::read_to_string(&path) {
                        // Try parsing
                        if let Ok(agent) = serde_json::from_str::<AgentDefinition>(&content) {
                             agents.push(agent);
                        } else {
                            println!("Failed to parse agent file: {:?}", path);
                        }
                    }
                }
            }
        }
    }
    
    Ok(agents)
}

#[tauri::command]
pub fn save_agent(agent: AgentDefinition, app: AppHandle) -> Result<(), AppError> {
    let dir = get_agents_dir(&app)?;
    // Sanitize ID just in case, though ID should be safe
    let safe_id: String = agent.id.chars().filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-').collect();
    let filename = format!("{}.json", safe_id);
    let path = dir.join(filename);
    
    let json = serde_json::to_string_pretty(&agent).map_err(|e| AppError::Unknown(e.to_string()))?;
    std::fs::write(path, json).map_err(|e| AppError::Io(e.to_string()))?;
    
    Ok(())
}

#[tauri::command]
pub fn delete_agent(agent_id: String, app: AppHandle) -> Result<(), AppError> {
    let dir = get_agents_dir(&app)?;
    let safe_id: String = agent_id.chars().filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-').collect();
    let filename = format!("{}.json", safe_id);
    let path = dir.join(filename);
    
    if path.exists() {
        std::fs::remove_file(path).map_err(|e| AppError::Io(e.to_string()))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn run_agent(
    agent_def: AgentDefinition, 
    inputs: serde_json::Value,
    context_node_id: Option<String>,
    state: State<'_, AppState>,
    app: AppHandle
) -> Result<String, AppError> {
    println!("Starting run_agent: {} with inputs: {:?}", agent_def.name, inputs); 

    let (api_key, base_url, model_name, project_id) = {
        let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock poisoned".to_string()))?;
        let db = db_guard.as_ref().ok_or(AppError::ProjectNotLoaded)?;
        
        let key = db.get_setting("gemini_api_key")?;
        let url = db.get_setting("gemini_base_url")?
            .unwrap_or("https://generativelanguage.googleapis.com".to_string());
        let model = db.get_setting("gemini_model_name")?
            .unwrap_or("gemini-1.5-flash".to_string());
            
        (key, url, model, "demo".to_string())
    };

    let api_key = api_key.ok_or(AppError::Agent("Please configure API Key in Settings".to_string()))?;
    
    let context = if let Some(nid) = context_node_id {
         format!("User is focusing on Node: {}", nid)
    } else {
         "No specific node selected.".to_string()
    };

    // Call Service
    let actions = call_gemini_agent(
        &api_key, 
        &base_url, 
        &model_name, 
        &agent_def.system_prompt,
        inputs, 
        context
    ).await.map_err(|e| AppError::Network(e))?;

    let mut response_text = String::new();
    let mut nodes_created = 0;

    {
        let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock poisoned".to_string()))?;
        let db = db_guard.as_ref().ok_or(AppError::ProjectNotLoaded)?;

        for action in actions {
            match action {
                GraphAction::Message { text } => {
                    response_text.push_str(&text);
                    response_text.push('\n');
                },
                GraphAction::CreateNode { node_type, label: _, description } => {
                    let asset_type = match node_type.as_str() {
                        "Text" => AssetType::Text,
                        "Prompt" => AssetType::Prompt,
                        "Image" => AssetType::Image,
                        _ => AssetType::Text // Default fallback
                    };
                    
                    // Use JSON string for description if it's structured data
                    let payload = description;
                    
                    let offset = (nodes_created + 1) as f64 * 250.0;
                    
                    if let Err(e) = db.create_asset_with_payload(&project_id, asset_type, 100.0 + offset, 100.0, &payload) {
                        println!("Failed to create node: {:?}", e);
                    } else {
                        nodes_created += 1;
                    }
                }
            }
        }
    }

    if nodes_created > 0 {
        app.emit("graph:updated", ()).map_err(|e| AppError::Unknown(e.to_string()))?;
        response_text.push_str(&format!("\n(Created {} new nodes)", nodes_created));
    }

    Ok(response_text.trim().to_string())
}

#[tauri::command]
pub fn save_settings(key: String, base_url: String, model_name: String, state: State<AppState>) -> Result<(), AppError> {
    state.get_db(|db| {
        db.set_setting("gemini_api_key", &key)?;
        db.set_setting("gemini_base_url", &base_url)?;
        db.set_setting("gemini_model_name", &model_name)?;
        Ok(())
    })
}

#[tauri::command]
pub fn get_api_key(state: State<AppState>) -> Result<String, AppError> {
    state.get_db(|db| {
        let key = db.get_setting("gemini_api_key")?;
        Ok(key.unwrap_or_default())
    })
}

#[tauri::command]
pub fn get_base_url(state: State<AppState>) -> Result<String, AppError> {
    state.get_db(|db| {
        let url = db.get_setting("gemini_base_url")?;
        Ok(url.unwrap_or("https://generativelanguage.googleapis.com".to_string()))
    })
}

#[tauri::command]
pub fn get_model_name(state: State<AppState>) -> Result<String, AppError> {
    state.get_db(|db| {
        let name = db.get_setting("gemini_model_name")?;
        Ok(name.unwrap_or("gemini-1.5-flash".to_string()))
    })
}
