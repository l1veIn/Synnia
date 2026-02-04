//! Settings Tauri commands.
//!
//! All settings are now stored in the global database (~/.synnia/synnia.db).

use crate::core::AppError;
use crate::global::database;
use crate::global::settings;

// ============================================
// AI Config (JSON blob)
// ============================================

#[tauri::command]
pub fn get_ai_config() -> Result<String, AppError> {
    let conn = database::init_global_db()?;
    let config: Option<String> = settings::get_json_setting(&conn, "ai_config")?;
    Ok(config.unwrap_or_else(|| "{}".to_string()))
}

#[tauri::command]
pub fn save_ai_config(config: String) -> Result<(), AppError> {
    let conn = database::init_global_db()?;
    // Store as raw JSON string (already serialized from frontend)
    settings::set_setting(&conn, "ai_config", &config)?;
    Ok(())
}

// ============================================
// Media Config (JSON blob)
// ============================================

#[tauri::command]
pub fn get_media_config() -> Result<String, AppError> {
    let conn = database::init_global_db()?;
    let config = settings::get_setting(&conn, "media_config")?;
    Ok(config.unwrap_or_else(|| "{}".to_string()))
}

#[tauri::command]
pub fn save_media_config(config: String) -> Result<(), AppError> {
    let conn = database::init_global_db()?;
    settings::set_setting(&conn, "media_config", &config)?;
    Ok(())
}

// ============================================
// App Settings (JSON blob)
// ============================================

#[tauri::command]
pub fn get_app_settings() -> Result<String, AppError> {
    let conn = database::init_global_db()?;
    let config = settings::get_setting(&conn, "app_settings")?;
    Ok(config.unwrap_or_else(|| "{}".to_string()))
}

#[tauri::command]
pub fn save_app_settings(settings_json: String) -> Result<(), AppError> {
    let conn = database::init_global_db()?;
    settings::set_setting(&conn, "app_settings", &settings_json)?;
    Ok(())
}

// ============================================
// Legacy Settings (for backward compatibility)
// ============================================

#[tauri::command]
pub fn save_settings(key: String, base_url: String, model_name: String) -> Result<(), AppError> {
    let conn = database::init_global_db()?;
    settings::set_setting(&conn, "gemini_api_key", &key)?;
    settings::set_setting(&conn, "gemini_base_url", &base_url)?;
    settings::set_setting(&conn, "gemini_model_name", &model_name)?;
    Ok(())
}

#[tauri::command]
pub fn get_api_key() -> Result<String, AppError> {
    let conn = database::init_global_db()?;
    let key = settings::get_setting(&conn, "gemini_api_key")?;
    Ok(key.unwrap_or_default())
}

#[tauri::command]
pub fn get_base_url() -> Result<String, AppError> {
    let conn = database::init_global_db()?;
    let url = settings::get_setting(&conn, "gemini_base_url")?;
    Ok(url.unwrap_or_else(|| "https://generativelanguage.googleapis.com".to_string()))
}

#[tauri::command]
pub fn get_model_name() -> Result<String, AppError> {
    let conn = database::init_global_db()?;
    let name = settings::get_setting(&conn, "gemini_model_name")?;
    Ok(name.unwrap_or_else(|| "gemini-1.5-flash".to_string()))
}

// ============================================
// System Directory Settings
// ============================================

/// Get projects directory (expanded path)
#[tauri::command]
pub fn get_projects_directory() -> Result<String, AppError> {
    let conn = database::init_global_db()?;
    let path = settings::get_setting(&conn, database::SETTING_PROJECTS_DIR)?
        .unwrap_or_else(|| database::DEFAULT_PROJECTS_DIR.to_string());
    
    // Return expanded path
    Ok(database::expand_path(&path).to_string_lossy().to_string())
}

/// Set projects directory
#[tauri::command]
pub fn set_projects_directory(path: String) -> Result<(), AppError> {
    let conn = database::init_global_db()?;
    settings::set_setting(&conn, database::SETTING_PROJECTS_DIR, &path)?;
    
    // Ensure directory exists
    let expanded = database::expand_path(&path);
    if !expanded.exists() {
        std::fs::create_dir_all(&expanded)
            .map_err(|e| AppError::Io(format!("Failed to create directory: {}", e)))?;
    }
    
    log::info!("Projects directory set to: {}", path);
    Ok(())
}

/// Get user recipes directory (expanded path)
#[tauri::command]
pub fn get_user_recipes_directory() -> Result<String, AppError> {
    let conn = database::init_global_db()?;
    let path = settings::get_setting(&conn, database::SETTING_USER_RECIPES_DIR)?
        .unwrap_or_else(|| database::DEFAULT_USER_RECIPES_DIR.to_string());
    
    Ok(database::expand_path(&path).to_string_lossy().to_string())
}

/// Set user recipes directory
#[tauri::command]
pub fn set_user_recipes_directory(path: String) -> Result<(), AppError> {
    let conn = database::init_global_db()?;
    settings::set_setting(&conn, database::SETTING_USER_RECIPES_DIR, &path)?;
    
    // Ensure directory exists
    let expanded = database::expand_path(&path);
    if !expanded.exists() {
        std::fs::create_dir_all(&expanded)
            .map_err(|e| AppError::Io(format!("Failed to create directory: {}", e)))?;
    }
    
    log::info!("User recipes directory set to: {}", path);
    Ok(())
}

/// Get a generic setting by key
#[tauri::command]
pub fn get_setting(key: String) -> Result<Option<String>, AppError> {
    let conn = database::init_global_db()?;
    settings::get_setting(&conn, &key)
}

/// Set a generic setting by key
#[tauri::command]
pub fn set_setting(key: String, value: String) -> Result<(), AppError> {
    let conn = database::init_global_db()?;
    settings::set_setting(&conn, &key, &value)
}
