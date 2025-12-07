use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri::Manager;
use std::path::PathBuf;
use std::fs;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GlobalConfig {
    pub recent_projects: Vec<RecentProject>,
    pub default_workspace: Option<String>,
    pub theme: Option<String>,
    pub language: Option<String>,
    
    // AI Configuration
    pub gemini_api_key: Option<String>,
    pub gemini_base_url: Option<String>,
    pub gemini_model_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RecentProject {
    pub name: String,
    pub path: String,
    pub last_opened: String, // ISO Date
}

impl GlobalConfig {
    pub fn load(app: &AppHandle) -> Self {
        // Retrieve the app configuration directory
        // e.g., on macOS: ~/Library/Application Support/com.your-domain.synnia/
        let config_dir = app.path().app_config_dir().unwrap_or_else(|_| PathBuf::from("."));
        
        if !config_dir.exists() {
            let _ = fs::create_dir_all(&config_dir);
        }
        
        let config_path = config_dir.join("config.json");
        
        if config_path.exists() {
            let content = fs::read_to_string(&config_path).unwrap_or_default();
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            GlobalConfig::default()
        }
    }

    pub fn save(&self, app: &AppHandle) -> Result<(), String> {
        let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
        if !config_dir.exists() {
            fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
        }
        let config_path = config_dir.join("config.json");
        let json = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        fs::write(config_path, json).map_err(|e| e.to_string())
    }

    pub fn add_recent(&mut self, name: String, path: String) {
        // Remove existing entry if present (deduplication)
        self.recent_projects.retain(|p| p.path != path);
        
        // Add to top (MRU)
        self.recent_projects.insert(0, RecentProject {
            name,
            path,
            last_opened: chrono::Utc::now().to_rfc3339(),
        });

        // Limit to 10 items
        if self.recent_projects.len() > 10 {
            self.recent_projects.truncate(10);
        }
    }

    pub fn set_workspace(&mut self, path: String) {
        self.default_workspace = Some(path);
    }
}