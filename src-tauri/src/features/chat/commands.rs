//! Chat persistence Tauri commands.
//!
//! All chat data is stored in the project directory: `{projectDir}/chat/`

use std::fs;
use std::path::PathBuf;
use tauri::State;

use super::types::{ChatIndex, ThreadData};
use crate::core::AppState;

/// Get the chat directory for the current project.
/// Path: `{projectDir}/chat/`
fn get_chat_dir(state: &State<AppState>) -> Result<PathBuf, String> {
    let project_path = state
        .current_project_path
        .lock()
        .map_err(|e| format!("Failed to lock project path: {}", e))?;

    let project_dir = project_path
        .as_ref()
        .ok_or("No project is currently open")?;

    Ok(PathBuf::from(project_dir).join("chat"))
}

/// Ensure the chat directory structure exists.
fn ensure_chat_dir(state: &State<AppState>) -> Result<PathBuf, String> {
    let chat_dir = get_chat_dir(state)?;
    let threads_dir = chat_dir.join("threads");

    if !chat_dir.exists() {
        fs::create_dir_all(&chat_dir).map_err(|e| e.to_string())?;
    }
    if !threads_dir.exists() {
        fs::create_dir_all(&threads_dir).map_err(|e| e.to_string())?;
    }

    Ok(chat_dir)
}

/// Get the chat index for the current project.
#[tauri::command]
pub async fn chat_get_index(state: State<'_, AppState>) -> Result<ChatIndex, String> {
    let chat_dir = ensure_chat_dir(&state)?;
    let index_path = chat_dir.join("index.json");

    if !index_path.exists() {
        return Ok(ChatIndex::default());
    }

    let content = fs::read_to_string(&index_path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

/// Save the chat index for the current project.
#[tauri::command]
pub async fn chat_save_index(state: State<'_, AppState>, index: ChatIndex) -> Result<(), String> {
    let chat_dir = ensure_chat_dir(&state)?;
    let index_path = chat_dir.join("index.json");

    let content = serde_json::to_string_pretty(&index).map_err(|e| e.to_string())?;

    // Atomic write: write to temp file then rename
    let temp_path = index_path.with_extension("json.tmp");
    fs::write(&temp_path, &content).map_err(|e| e.to_string())?;
    fs::rename(&temp_path, &index_path).map_err(|e| e.to_string())?;

    Ok(())
}

/// Get a single thread by ID.
#[tauri::command]
pub async fn chat_get_thread(
    state: State<'_, AppState>,
    thread_id: String,
) -> Result<Option<ThreadData>, String> {
    let chat_dir = get_chat_dir(&state)?;
    let thread_path = chat_dir.join("threads").join(format!("{}.json", thread_id));

    if !thread_path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&thread_path).map_err(|e| e.to_string())?;
    let thread = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(Some(thread))
}

/// Save a thread.
#[tauri::command]
pub async fn chat_save_thread(state: State<'_, AppState>, thread: ThreadData) -> Result<(), String> {
    let chat_dir = ensure_chat_dir(&state)?;
    let thread_path = chat_dir
        .join("threads")
        .join(format!("{}.json", &thread.id));

    let content = serde_json::to_string_pretty(&thread).map_err(|e| e.to_string())?;

    // Atomic write
    let temp_path = thread_path.with_extension("json.tmp");
    fs::write(&temp_path, &content).map_err(|e| e.to_string())?;
    fs::rename(&temp_path, &thread_path).map_err(|e| e.to_string())?;

    Ok(())
}

/// Delete a thread by ID.
#[tauri::command]
pub async fn chat_delete_thread(state: State<'_, AppState>, thread_id: String) -> Result<(), String> {
    let chat_dir = get_chat_dir(&state)?;
    let thread_path = chat_dir.join("threads").join(format!("{}.json", thread_id));

    if thread_path.exists() {
        fs::remove_file(&thread_path).map_err(|e| e.to_string())?;
    }

    Ok(())
}
