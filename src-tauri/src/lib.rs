//! Synnia Tauri Backend
//!
//! This is the main library entry point for the Tauri application.
//! Uses a modular architecture with clear separation of concerns:
//!
//! - `core/`: Error handling and application state
//! - `domain/`: Pure data structures (models)
//! - `infrastructure/`: Low-level utilities (database, http, server, hash)
//! - `features/`: Domain-specific modules (project, asset, recipe, etc.)
//! - `app/`: Tauri application setup

use std::sync::{Mutex, Arc};
use tauri::{Manager, State};
use serde::{Serialize, Deserialize};
use ts_rs::TS;

// ============================================
// NEW Modular Architecture
// ============================================

/// Core module: Error handling and application state
pub mod core;

/// Domain module: Pure data structures (models with ts-rs)
pub mod domain;

/// Infrastructure module: Low-level utilities
pub mod infrastructure;

/// Features module: Domain-specific logic
pub mod features;

/// Application module: Tauri setup and initialization
pub mod app;

/// Global data module: App-wide database (~/.synnia/synnia.db)
pub mod global;


// Re-export core types
pub use core::{AppError, AppState};

// ============================================
// Utility Commands
// ============================================

#[derive(Serialize, Deserialize, TS)]
#[ts(export)]
struct GreetResponse {
    greeting: String,
    name: String,
}

#[tauri::command]
async fn ping(name: String) -> GreetResponse {
    GreetResponse {
        greeting: format!("Hello, {name}! You've been greeted from Rust!"),
        name,
    }
}

#[tauri::command]
fn get_server_port(state: State<core::AppState>) -> u16 {
    state.server_port
}

// ============================================
// Application Entry Point
// ============================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Shared State for Project Path
    let current_project_path = Arc::new(Mutex::new(None));

    // Start Local File Server
    let server_port = infrastructure::server::init(current_project_path.clone());

    tauri::Builder::default()
        .manage(core::AppState {
            current_project_path,
            server_port,
        })
        .setup(|app| {
            app.handle().plugin(tauri_plugin_dialog::init())?;
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Debug)
                        .build(),
                )?;
            }

            if let Some(window) = app.get_webview_window("main") {
                #[cfg(target_os = "windows")]
                let _ = window.set_decorations(false);

                #[cfg(target_os = "macos")]
                let _ = window.set_title("");
                
                #[cfg(debug_assertions)]
                window.open_devtools();
            }
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Utility commands
            ping,
            get_server_port,

            // ============================================
            // NEW FEATURE MODULES
            // ============================================

            // Project commands
            features::project::commands::init_project,
            features::project::commands::get_recent_projects,
            features::project::commands::get_default_projects_path,
            features::project::commands::set_default_projects_path,
            features::project::commands::create_project,
            features::project::commands::load_project,
            features::project::commands::save_project,
            features::project::commands::save_project_autosave,
            features::project::commands::get_current_project_path,
            features::project::commands::delete_project,
            features::project::commands::reset_project,
            features::project::commands::set_thumbnail,
            features::project::commands::open_in_browser,
            features::project::commands::rename_project,

            // Asset commands
            features::asset::commands::import_file,
            features::asset::commands::save_processed_image,
            features::asset::commands::download_and_save_image,
            features::asset::commands::batch_import_images,
            features::asset::commands::get_media_assets,
            features::asset::commands::delete_media_asset,
            features::asset::commands::cleanup_orphan_assets,

            // History commands
            features::history::commands::save_asset,
            features::history::commands::get_asset_history,
            features::history::commands::get_history_content,
            features::history::commands::restore_asset_version,
            features::history::commands::count_asset_history,

            // Settings commands
            features::settings::commands::save_settings,
            features::settings::commands::get_api_key,
            features::settings::commands::get_base_url,
            features::settings::commands::get_model_name,
            features::settings::commands::get_ai_config,
            features::settings::commands::save_ai_config,
            features::settings::commands::get_media_config,
            features::settings::commands::save_media_config,
            features::settings::commands::get_app_settings,
            features::settings::commands::save_app_settings,
            features::settings::commands::get_projects_directory,
            features::settings::commands::set_projects_directory,
            features::settings::commands::get_user_recipes_directory,
            features::settings::commands::set_user_recipes_directory,
            features::settings::commands::get_setting,
            features::settings::commands::set_setting,

            // Agent commands
            features::agent::commands::run_agent,
            features::agent::commands::get_agents,
            features::agent::commands::save_agent,
            features::agent::commands::delete_agent,

            // Operations: Chat
            features::operations::chat::get_chat_messages,
            features::operations::chat::add_chat_message,
            features::operations::chat::clear_chat_messages,

            // Operations: Logs
            features::operations::logs::get_execution_runs,
            features::operations::logs::create_execution_run,
            features::operations::logs::update_execution_run,
            features::operations::logs::append_log_entry,
            features::operations::logs::get_log_entries,
            features::operations::logs::clear_execution_logs,

            // Recipe commands
            features::recipe::commands::list_recipe_directory,
            features::recipe::commands::get_recipe_file_tree,
            features::recipe::commands::read_recipe_file,
            features::recipe::commands::write_recipe_file,
            features::recipe::commands::create_recipe_file,
            features::recipe::commands::delete_recipe_file,
            features::recipe::commands::create_recipe,
            features::recipe::commands::create_recipe_folder,
            features::recipe::commands::delete_recipe,
            features::recipe::commands::get_recipes_base_path,

            // Recipe Index (FTS5 search)
            features::recipe::index::sync_recipe_index,
            features::recipe::index::sync_recipe_index_async,
            features::recipe::index::search_recipes,
            features::recipe::index::list_indexed_recipes,
            features::recipe::index::get_indexed_recipe,
            features::recipe::index::get_recipe_categories,
            features::recipe::index::get_recipe_tags,
            features::recipe::index::get_recipe_manifest,
            features::recipe::index::get_recipe_manifest_by_id,
            features::recipe::index::clear_recipe_index,
            features::recipe::index::get_recipe_count,

            // Project Validation
            features::project::commands::validate_projects,

            // HTTP Proxy
            infrastructure::http::proxy_request,
            infrastructure::http::fetch_image_as_base64,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if window.label() == "main" {
                    window.app_handle().exit(0);
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}