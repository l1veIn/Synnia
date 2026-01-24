//! Settings Tauri commands.

use tauri::AppHandle;

use crate::core::AppError;
use super::config::GlobalConfig;

#[tauri::command]
pub fn get_ai_config(app: AppHandle) -> Result<String, AppError> {
    let config = GlobalConfig::load(&app);
    Ok(config.ai_config.unwrap_or_default())
}

#[tauri::command]
pub fn save_ai_config(config: String, app: AppHandle) -> Result<(), AppError> {
    let mut global_config = GlobalConfig::load(&app);
    global_config.ai_config = Some(config);
    global_config.save(&app).map_err(|e| AppError::Config(e))?;
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
    global_config.save(&app).map_err(|e| AppError::Config(e))?;
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
    global_config.save(&app).map_err(|e| AppError::Config(e))?;
    Ok(())
}

// Legacy settings (for backward compatibility)
#[tauri::command]
pub fn save_settings(key: String, base_url: String, model_name: String, app: AppHandle) -> Result<(), AppError> {
    let mut config = GlobalConfig::load(&app);
    config.gemini_api_key = Some(key);
    config.gemini_base_url = Some(base_url);
    config.gemini_model_name = Some(model_name);
    config.save(&app).map_err(|e| AppError::Config(e))?;
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
