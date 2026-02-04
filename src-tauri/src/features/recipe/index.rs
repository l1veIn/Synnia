//! Recipe index Tauri commands.
//!
//! Provides recipe indexing and search functionality using the global database.

use tauri::{AppHandle, Emitter, State};
use crate::core::{AppError, AppState};
use crate::infrastructure::surreal::global::recipes;

// ============================================
// Index Sync Commands
// ============================================

/// Synchronize the recipe index by scanning all recipes (sync).
#[tauri::command]
pub async fn sync_recipe_index(state: State<'_, AppState>) -> Result<recipes::ScanResult, AppError> {
    recipes::scan_all_recipes(&state.global_db).await
}

/// Synchronize the recipe index in the background (async).
/// Emits "recipes:indexed" event when complete with ScanResult payload.
#[tauri::command]
pub async fn sync_recipe_index_async(app: AppHandle, state: State<'_, AppState>) -> Result<(), AppError> {
    // Spawn background task
    let db = state.global_db.clone();
    tauri::async_runtime::spawn(async move {
        let result = recipes::scan_all_recipes(&db).await;
        
        // Emit result to frontend
        match result {
            Ok(scan_result) => {
                let _ = app.emit("recipes:indexed", scan_result);
            }
            Err(e) => {
                let _ = app.emit("recipes:index_error", e.to_string());
            }
        }
    });
    
    Ok(())
}

// ============================================
// Search Commands
// ============================================

/// Search recipes using FTS5 full-text search.
#[tauri::command]
pub async fn search_recipes(query: String, limit: Option<i32>, state: State<'_, AppState>) -> Result<Vec<recipes::RecipeMeta>, AppError> {
    recipes::search_recipes(&state.global_db, &query, limit).await
}

/// List recipes with optional filtering.
#[tauri::command]
pub async fn list_indexed_recipes(
    source: Option<String>,
    category: Option<String>,
    limit: Option<i32>,
    state: State<'_, AppState>,
) -> Result<Vec<recipes::RecipeMeta>, AppError> {
    let filter = recipes::RecipeFilter {
        source: source.map(|s| recipes::RecipeSource::from_str(&s)),
        category,
        tags: None,
        limit,
    };
    
    recipes::list_recipes(&state.global_db, filter).await
}

/// Get a single recipe by ID.
#[tauri::command]
pub async fn get_indexed_recipe(id: String, state: State<'_, AppState>) -> Result<Option<recipes::RecipeMeta>, AppError> {
    recipes::get_recipe_by_id(&state.global_db, &id).await
}

// ============================================
// Metadata Commands
// ============================================

/// Get all unique categories from indexed recipes.
#[tauri::command]
pub async fn get_recipe_categories(state: State<'_, AppState>) -> Result<Vec<String>, AppError> {
    recipes::get_all_categories(&state.global_db).await
}

/// Get all unique tags from indexed recipes.
#[tauri::command]
pub async fn get_recipe_tags(state: State<'_, AppState>) -> Result<Vec<String>, AppError> {
    recipes::get_all_tags(&state.global_db).await
}

// ============================================
// Manifest Loading Commands
// ============================================

/// Get the full recipe manifest with all $ref resolved.
/// Used for on-demand loading when user selects a recipe.
#[tauri::command]
pub async fn get_recipe_manifest(
    source: String,
    path: String,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let source = recipes::RecipeSource::from_str(&source);
    recipes::get_recipe_manifest(&source, &path, &state.global_db).await
}

/// Get recipe manifest by ID (looks up source and path from index).
#[tauri::command]
pub async fn get_recipe_manifest_by_id(id: String, state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    recipes::get_recipe_manifest_by_id(&state.global_db, &id).await
}

// ============================================
// Index Management Commands
// ============================================

/// Clear all recipes from the index.
/// Does NOT delete the actual recipe files.
#[tauri::command]
pub async fn clear_recipe_index(state: State<'_, AppState>) -> Result<u32, AppError> {
    recipes::clear_recipe_index(&state.global_db).await
}

/// Get the total count of indexed recipes.
#[tauri::command]
pub async fn get_recipe_count(state: State<'_, AppState>) -> Result<u32, AppError> {
    recipes::get_recipe_count(&state.global_db).await
}
