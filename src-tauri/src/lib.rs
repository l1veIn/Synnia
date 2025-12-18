use tauri::{Manager, State};
use serde::{Serialize, Deserialize};
use ts_rs::TS;
use std::sync::{Mutex, Arc};

mod commands;
// mod db; // Removed
mod models;
mod services;
mod error;
mod config;
mod state; 

use state::AppState; 

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
fn get_server_port(state: State<AppState>) -> u16 {
    state.server_port
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Shared State for Project Path (between Tauri Commands and Actix)
    let current_project_path = Arc::new(Mutex::new(None));

    // Start Local File Server
    let server_port = services::file_server::init(current_project_path.clone());

    tauri::Builder::default()
        .manage(AppState {
            current_project_path,
            server_port,
        })
        .setup(|app| {
            app.handle().plugin(tauri_plugin_dialog::init())?; // Init dialog plugin
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Debug)
                        .build(),
                )?;
            }

            if let Some(window) = app.get_webview_window("main") {
                // Windows: Manual borderless
                #[cfg(target_os = "windows")]
                let _ = window.set_decorations(false);

                // macOS: Clear title to avoid text over custom bar
                #[cfg(target_os = "macos")]
                let _ = window.set_title("");
                
                #[cfg(debug_assertions)]
                window.open_devtools();
            }
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ping,
            get_server_port,
            // Project Commands
            commands::project::init_project,
            commands::project::get_recent_projects,
            commands::project::get_default_projects_path,
            commands::project::set_default_projects_path,
            commands::project::create_project,
            commands::project::load_project, // New
            commands::project::save_project, // New
            commands::project::save_project_autosave, // New
            commands::project::get_current_project_path,
            commands::project::delete_project,
            commands::project::reset_project,
            commands::project::set_thumbnail,
            commands::project::open_in_browser,
            commands::project::rename_project,

            // Graph Commands REMOVED

            // Agent Commands
            commands::agent::save_settings,
            commands::agent::get_api_key,
            commands::agent::get_base_url,
            commands::agent::get_model_name,
            commands::agent::run_agent,
            commands::agent::get_agents,
            commands::agent::save_agent,
            commands::agent::delete_agent,
            commands::agent::get_ai_config,
            commands::agent::save_ai_config,
            commands::agent::get_media_config,
            commands::agent::save_media_config,
            commands::agent::get_app_settings,
            commands::agent::save_app_settings,

            // Asset Commands
            commands::asset::import_file,
            commands::asset::save_processed_image,
            commands::asset::get_media_assets,

            // History Commands
            commands::history::save_asset_with_history,
            commands::history::get_asset_history,
            commands::history::get_history_content,
            commands::history::restore_asset_version,
            commands::history::count_asset_history,

            // HTTP Proxy
            commands::http_proxy::proxy_request,
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