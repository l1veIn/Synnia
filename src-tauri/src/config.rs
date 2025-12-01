use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs;
use tauri::AppHandle;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecentProject {
    pub name: String,
    pub path: String,
    pub last_opened: String, // ISO String
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct GlobalConfig {
    pub recent_projects: Vec<RecentProject>,
    pub theme: Option<String>,
    pub default_workspace: Option<String>, // New field
}

impl GlobalConfig {
    fn get_config_path(app: &AppHandle) -> Option<PathBuf> {
        app.path().app_config_dir().ok().map(|p| p.join("global_config.json"))
    }

    pub fn load(app: &AppHandle) -> Self {
        if let Some(path) = Self::get_config_path(app) {
            if path.exists() {
                if let Ok(content) = fs::read_to_string(path) {
                    if let Ok(config) = serde_json::from_str(&content) {
                        return config;
                    }
                }
            }
        }
        Self::default()
    }

    pub fn save(&self, app: &AppHandle) -> Result<(), String> {
        if let Some(path) = Self::get_config_path(app) {
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let content = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
            fs::write(path, content).map_err(|e| e.to_string())?;
            Ok(())
        } else {
            Err("Could not resolve config directory".to_string())
        }
    }

    pub fn add_recent(&mut self, name: String, path: String) {
        self.recent_projects.retain(|p| p.path != path);
        
        self.recent_projects.insert(0, RecentProject {
            name,
            path,
            last_opened: chrono::Utc::now().to_rfc3339(),
        });

        if self.recent_projects.len() > 10 {
            self.recent_projects.truncate(10);
        }
    }

    pub fn set_workspace(&mut self, path: String) {
        self.default_workspace = Some(path);
    }
}