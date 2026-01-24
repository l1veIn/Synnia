//! Agent Tauri commands.
//!
//! TODO: Migrate from commands/agent.rs after asset module is complete

use tauri::{State, AppHandle, Manager};
use std::path::PathBuf;

use crate::core::{AppError, AppState};
use crate::domain::AgentDefinition;
use crate::features::settings::config::GlobalConfig;
use super::service::GraphAction;

fn get_agents_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    let docs_dir = app.path().document_dir()
        .map_err(|_| AppError::Unknown("No documents directory found".into()))?;
    let agents_dir = docs_dir.join("Synnia").join("Agents");
    if !agents_dir.exists() {
        std::fs::create_dir_all(&agents_dir)?;
    }
    Ok(agents_dir)
}

#[tauri::command]
pub fn get_agents(app: AppHandle) -> Result<Vec<AgentDefinition>, AppError> {
    let mut agents = Vec::new();
    
    if let Ok(dir) = get_agents_dir(&app) {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("json") {
                    if let Ok(content) = std::fs::read_to_string(&path) {
                        if let Ok(agent) = serde_json::from_str::<AgentDefinition>(&content) {
                             agents.push(agent);
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
    let safe_id: String = agent.id.chars()
        .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-')
        .collect();
    let filename = format!("{}.json", safe_id);
    let path = dir.join(filename);
    
    let json = serde_json::to_string_pretty(&agent)?;
    std::fs::write(path, json)?;
    
    Ok(())
}

#[tauri::command]
pub fn delete_agent(agent_id: String, app: AppHandle) -> Result<(), AppError> {
    let dir = get_agents_dir(&app)?;
    let safe_id: String = agent_id.chars()
        .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-')
        .collect();
    let filename = format!("{}.json", safe_id);
    let path = dir.join(filename);
    
    if path.exists() {
        std::fs::remove_file(path)?;
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
    let config = GlobalConfig::load(&app);
    let api_key = config.gemini_api_key
        .ok_or(AppError::Agent("Please configure Gemini API Key in Settings".to_string()))?;
    let base_url = config.gemini_base_url
        .unwrap_or("https://generativelanguage.googleapis.com".to_string());
    let model_name = config.gemini_model_name
        .unwrap_or("gemini-1.5-flash".to_string());
    
    let context = if let Some(nid) = context_node_id {
         format!("User is focusing on Node: {}", nid)
    } else {
         "No specific node selected.".to_string()
    };

    let actions = super::service::call_gemini_agent(
        &api_key, 
        &base_url, 
        &model_name, 
        &agent_def.system_prompt,
        inputs, 
        context
    ).await.map_err(|e| AppError::Network(e))?;

    Ok(actions)
}
