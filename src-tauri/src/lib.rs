use tauri::Manager;
use serde::{Serialize, Deserialize};
use ts_rs::TS;
use std::sync::Mutex;

mod models;
mod db;
mod commands;

use commands::AppState;

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
            db: Mutex::new(None),
            current_project_path: Mutex::new(None),
        })
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Debug)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ping,
            commands::init_project,
            commands::create_node,
            commands::get_nodes,
            commands::create_edge,
            commands::get_edges,
            commands::update_node_pos,
            commands::reset_project
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
