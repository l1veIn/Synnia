//! Settings Tauri commands.
//!
//! All settings are now stored in the global database (~/.synnia/synnia.db).

use crate::core::AppError;
use tauri::State;
use crate::core::AppState;
use crate::global::database;
use crate::infrastructure::surreal::global::settings;

// ============================================
// AI Config (JSON blob)
// ============================================

#[tauri::command]
pub async fn get_ai_config(state: State<'_, AppState>) -> Result<String, AppError> {
    let config: Option<String> = settings::get_json_setting(&state.global_db, "ai_config").await?;
    Ok(config.unwrap_or_else(|| "{}".to_string()))
}

#[tauri::command]
pub async fn save_ai_config(config: String, state: State<'_, AppState>) -> Result<(), AppError> {
    // Store as raw JSON string (already serialized from frontend)
    settings::set_setting(&state.global_db, "ai_config", &config).await?;
    Ok(())
}

// ============================================
// Media Config (JSON blob)
// ============================================

#[tauri::command]
pub async fn get_media_config(state: State<'_, AppState>) -> Result<String, AppError> {
    let config = settings::get_setting(&state.global_db, "media_config").await?;
    Ok(config.unwrap_or_else(|| "{}".to_string()))
}

#[tauri::command]
pub async fn save_media_config(config: String, state: State<'_, AppState>) -> Result<(), AppError> {
    settings::set_setting(&state.global_db, "media_config", &config).await?;
    Ok(())
}

// ============================================
// App Settings (JSON blob)
// ============================================

#[tauri::command]
pub async fn get_app_settings(state: State<'_, AppState>) -> Result<String, AppError> {
    let config = settings::get_setting(&state.global_db, "app_settings").await?;
    Ok(config.unwrap_or_else(|| "{}".to_string()))
}

#[tauri::command]
pub async fn save_app_settings(settings_json: String, state: State<'_, AppState>) -> Result<(), AppError> {
    settings::set_setting(&state.global_db, "app_settings", &settings_json).await?;
    Ok(())
}

// ============================================
// Legacy Settings (for backward compatibility)
// ============================================

#[tauri::command]
pub async fn save_settings(key: String, base_url: String, model_name: String, state: State<'_, AppState>) -> Result<(), AppError> {
    settings::set_setting(&state.global_db, "gemini_api_key", &key).await?;
    settings::set_setting(&state.global_db, "gemini_base_url", &base_url).await?;
    settings::set_setting(&state.global_db, "gemini_model_name", &model_name).await?;
    Ok(())
}

#[tauri::command]
pub async fn get_api_key(state: State<'_, AppState>) -> Result<String, AppError> {
    let key = settings::get_setting(&state.global_db, "gemini_api_key").await?;
    Ok(key.unwrap_or_default())
}

#[tauri::command]
pub async fn get_base_url(state: State<'_, AppState>) -> Result<String, AppError> {
    let url = settings::get_setting(&state.global_db, "gemini_base_url").await?;
    Ok(url.unwrap_or_else(|| "https://generativelanguage.googleapis.com".to_string()))
}

#[tauri::command]
pub async fn get_model_name(state: State<'_, AppState>) -> Result<String, AppError> {
    let name = settings::get_setting(&state.global_db, "gemini_model_name").await?;
    Ok(name.unwrap_or_else(|| "gemini-1.5-flash".to_string()))
}

// ============================================
// System Directory Settings
// ============================================

/// Get projects directory (expanded path)
#[tauri::command]
pub async fn get_projects_directory(state: State<'_, AppState>) -> Result<String, AppError> {
    let path = settings::get_setting(&state.global_db, database::SETTING_PROJECTS_DIR).await?
        .unwrap_or_else(|| database::DEFAULT_PROJECTS_DIR.to_string());
    
    // Return expanded path
    Ok(database::expand_path(&path).to_string_lossy().to_string())
}

/// Set projects directory
#[tauri::command]
pub async fn set_projects_directory(path: String, state: State<'_, AppState>) -> Result<(), AppError> {
    settings::set_setting(&state.global_db, database::SETTING_PROJECTS_DIR, &path).await?;
    
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
pub async fn get_user_recipes_directory(state: State<'_, AppState>) -> Result<String, AppError> {
    let path = settings::get_setting(&state.global_db, database::SETTING_USER_RECIPES_DIR).await?
        .unwrap_or_else(|| database::DEFAULT_USER_RECIPES_DIR.to_string());
    
    Ok(database::expand_path(&path).to_string_lossy().to_string())
}

/// Set user recipes directory
#[tauri::command]
pub async fn set_user_recipes_directory(path: String, state: State<'_, AppState>) -> Result<(), AppError> {
    settings::set_setting(&state.global_db, database::SETTING_USER_RECIPES_DIR, &path).await?;
    
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
pub async fn get_setting(key: String, state: State<'_, AppState>) -> Result<Option<String>, AppError> {
    settings::get_setting(&state.global_db, &key).await
}

/// Set a generic setting by key
#[tauri::command]
pub async fn set_setting(key: String, value: String, state: State<'_, AppState>) -> Result<(), AppError> {
    settings::set_setting(&state.global_db, &key, &value).await
}
