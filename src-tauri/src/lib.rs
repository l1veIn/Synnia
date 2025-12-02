use tauri::Manager;
use serde::{Serialize, Deserialize};
use ts_rs::TS;
use std::sync::Mutex;

mod commands;
// mod db; // Removed
mod models;
mod services;
mod error;
mod config;
mod state; 

use state::AppState; 

#[derive(Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/greet_response.ts")]
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            // db: Mutex::new(None), // Removed
            current_project_path: Mutex::new(None),
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
            // Project Commands
            commands::project::init_project,
            commands::project::get_recent_projects,
            commands::project::get_default_projects_path,
            commands::project::set_default_projects_path,
            commands::project::create_project,
            commands::project::load_project, // New
            commands::project::save_project, // New
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

            // Asset Commands
            commands::asset::import_file,
            commands::asset::save_processed_image,
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