//! Chat Tauri commands.

use std::fs;
use std::path::PathBuf;
use tauri::State;

use crate::core::{AppError, AppState};
use super::types::{ChatIndex, ThreadData};

/// Get the chat directory path within the current project.
fn get_chat_dir(state: &State<AppState>) -> Result<PathBuf, AppError> {
    let project_path = get_project_path(state)?;
    Ok(project_path.join(".synnia").join("chat"))
}

/// Get the current project path from app state.
fn get_project_path(state: &State<AppState>) -> Result<PathBuf, AppError> {
    let path_guard = state.current_project_path.lock()
        .map_err(|_| AppError::Unknown("Lock poisoned".to_string()))?;
    
    path_guard
        .as_ref()
        .map(|p| PathBuf::from(p))
        .ok_or(AppError::ProjectNotLoaded)
}

/// Ensure chat directory and threads subdirectory exist.
fn ensure_chat_dir(state: &State<AppState>) -> Result<PathBuf, AppError> {
    let chat_dir = get_chat_dir(state)?;
    let threads_dir = chat_dir.join("threads");

    if !chat_dir.exists() {
        fs::create_dir_all(&chat_dir)
            .map_err(|e| AppError::Io(format!("Failed to create chat dir: {}", e)))?;
    }
    if !threads_dir.exists() {
        fs::create_dir_all(&threads_dir)
            .map_err(|e| AppError::Io(format!("Failed to create threads dir: {}", e)))?;
    }

    Ok(chat_dir)
}

/// Get the chat index (list of all threads).
#[tauri::command]
pub async fn chat_get_index(state: State<'_, AppState>) -> Result<ChatIndex, String> {
    let chat_dir = ensure_chat_dir(&state).map_err(|e| e.to_string())?;
    let index_path = chat_dir.join("index.json");

    if !index_path.exists() {
        return Ok(ChatIndex::default());
    }

    let content = fs::read_to_string(&index_path)
        .map_err(|e| format!("Failed to read index: {}", e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse index: {}", e))
}

/// Save the chat index.
#[tauri::command]
pub async fn chat_save_index(state: State<'_, AppState>, index: ChatIndex) -> Result<(), String> {
    let chat_dir = ensure_chat_dir(&state).map_err(|e| e.to_string())?;
    let index_path = chat_dir.join("index.json");

    let content = serde_json::to_string_pretty(&index)
        .map_err(|e| format!("Failed to serialize index: {}", e))?;

    // Atomic write: temp file + rename
    let temp_path = index_path.with_extension("json.tmp");
    fs::write(&temp_path, &content)
        .map_err(|e| format!("Failed to write temp index: {}", e))?;
    fs::rename(&temp_path, &index_path)
        .map_err(|e| format!("Failed to rename index: {}", e))?;

    Ok(())
}

/// Get a single thread by ID.
#[tauri::command]
pub async fn chat_get_thread(
    state: State<'_, AppState>,
    thread_id: String,
) -> Result<Option<ThreadData>, String> {
    let chat_dir = get_chat_dir(&state).map_err(|e| e.to_string())?;
    let thread_path = chat_dir.join("threads").join(format!("{}.json", thread_id));

    if !thread_path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&thread_path)
        .map_err(|e| format!("Failed to read thread: {}", e))?;
    let thread = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse thread: {}", e))?;
    Ok(Some(thread))
}

/// Save a thread.
#[tauri::command]
pub async fn chat_save_thread(state: State<'_, AppState>, thread: ThreadData) -> Result<(), String> {
    let chat_dir = ensure_chat_dir(&state).map_err(|e| e.to_string())?;
    let thread_path = chat_dir.join("threads").join(format!("{}.json", &thread.id));

    let content = serde_json::to_string_pretty(&thread)
        .map_err(|e| format!("Failed to serialize thread: {}", e))?;

    // Atomic write: temp file + rename
    let temp_path = thread_path.with_extension("json.tmp");
    fs::write(&temp_path, &content)
        .map_err(|e| format!("Failed to write temp thread: {}", e))?;
    fs::rename(&temp_path, &thread_path)
        .map_err(|e| format!("Failed to rename thread: {}", e))?;

    Ok(())
}

/// Delete a thread.
#[tauri::command]
pub async fn chat_delete_thread(state: State<'_, AppState>, thread_id: String) -> Result<(), String> {
    let chat_dir = get_chat_dir(&state).map_err(|e| e.to_string())?;
    let thread_path = chat_dir.join("threads").join(format!("{}.json", thread_id));

    if thread_path.exists() {
        fs::remove_file(&thread_path)
            .map_err(|e| format!("Failed to delete thread: {}", e))?;
    }

    Ok(())
}
