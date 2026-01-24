//! Application setup and initialization.
//! 
//! NOTE: This module contains the app builder for future use.
//! Currently, lib.rs has its own run() function that handles setup.

use tauri::Manager;
use std::sync::{Mutex, Arc};

use crate::core::AppState;
use crate::infrastructure::server;

// ============================================
// Application Builder (for future use)
// ============================================

/// Initialize the Tauri application with all plugins and handlers.
#[allow(dead_code)]
pub fn build_app() -> tauri::Builder<tauri::Wry> {
    let current_project_path = Arc::new(Mutex::new(None));
    let server_port = server::init(current_project_path.clone());

    tauri::Builder::default()
        .manage(AppState {
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
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if window.label() == "main" {
                    window.app_handle().exit(0);
                }
            }
        })
}
