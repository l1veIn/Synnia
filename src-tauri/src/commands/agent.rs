use tauri::{State, AppHandle, Manager};
use std::path::PathBuf;
use crate::error::AppError;
use crate::models::{AgentDefinition};
use crate::services::agent_service::{call_gemini_agent, GraphAction};
use crate::AppState;
use crate::config::GlobalConfig;

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
    // Sanitize ID just in case
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
    _state: State<'_, AppState>,
    app: AppHandle
) -> Result<Vec<GraphAction>, AppError> {
    println!("Starting run_agent: {} with inputs: {:?}", agent_def.name, inputs); 

    // 1. Load Config
    let config = GlobalConfig::load(&app);
    let api_key = config.gemini_api_key.ok_or(AppError::Agent("Please configure Gemini API Key in Settings".to_string()))?;
    let base_url = config.gemini_base_url.unwrap_or("https://generativelanguage.googleapis.com".to_string());
    let model_name = config.gemini_model_name.unwrap_or("gemini-1.5-flash".to_string());
    
    let context = if let Some(nid) = context_node_id {
         format!("User is focusing on Node: {}", nid)
    } else {
         "No specific node selected.".to_string()
    };

    // 2. Call Service
    let actions = call_gemini_agent(
        &api_key, 
        &base_url, 
        &model_name, 
        &agent_def.system_prompt,
        inputs, 
        context
    ).await.map_err(|e| AppError::Network(e))?;

    // 3. Return actions to Frontend
    Ok(actions)
}

#[tauri::command]
pub fn save_settings(key: String, base_url: String, model_name: String, app: AppHandle) -> Result<(), AppError> {
    let mut config = GlobalConfig::load(&app);
    config.gemini_api_key = Some(key);
    config.gemini_base_url = Some(base_url);
    config.gemini_model_name = Some(model_name);
    config.save(&app).map_err(|e| AppError::Unknown(e))?;
    Ok(())
}

#[tauri::command]
pub fn get_api_key(app: AppHandle) -> Result<String, AppError> {
    let config = GlobalConfig::load(&app);
    Ok(config.gemini_api_key.unwrap_or_default())
}

#[tauri::command]
pub fn get_base_url(app: AppHandle) -> Result<String, AppError> {
    let config = GlobalConfig::load(&app);
    Ok(config.gemini_base_url.unwrap_or("https://generativelanguage.googleapis.com".to_string()))
}

#[tauri::command]
pub fn get_model_name(app: AppHandle) -> Result<String, AppError> {
    let config = GlobalConfig::load(&app);
    Ok(config.gemini_model_name.unwrap_or("gemini-1.5-flash".to_string()))
}

#[tauri::command]
pub fn get_ai_config(app: AppHandle) -> Result<String, AppError> {
    let config = GlobalConfig::load(&app);
    Ok(config.ai_config.unwrap_or_default())
}

#[tauri::command]
pub fn save_ai_config(config: String, app: AppHandle) -> Result<(), AppError> {
    let mut global_config = GlobalConfig::load(&app);
    global_config.ai_config = Some(config);
    global_config.save(&app).map_err(|e| AppError::Unknown(e))?;
    Ok(())
}

#[tauri::command]
pub fn get_media_config(app: AppHandle) -> Result<String, AppError> {
    let config = GlobalConfig::load(&app);
    Ok(config.media_config.unwrap_or_default())
}

#[tauri::command]
pub fn save_media_config(config: String, app: AppHandle) -> Result<(), AppError> {
    let mut global_config = GlobalConfig::load(&app);
    global_config.media_config = Some(config);
    global_config.save(&app).map_err(|e| AppError::Unknown(e))?;
    Ok(())
}

#[tauri::command]
pub fn get_app_settings(app: AppHandle) -> Result<String, AppError> {
    let config = GlobalConfig::load(&app);
    Ok(config.app_settings.unwrap_or_default())
}

#[tauri::command]
pub fn save_app_settings(settings: String, app: AppHandle) -> Result<(), AppError> {
    let mut global_config = GlobalConfig::load(&app);
    global_config.app_settings = Some(settings);
    global_config.save(&app).map_err(|e| AppError::Unknown(e))?;
    Ok(())
}