//! Recipe index Tauri commands.
//!
//! Provides recipe indexing and search functionality using the global database.

use tauri::{AppHandle, Emitter};
use crate::core::AppError;
use crate::global::{database, recipes};

// ============================================
// Index Sync Commands
// ============================================

/// Synchronize the recipe index by scanning all recipes (sync).
#[tauri::command]
pub fn sync_recipe_index() -> Result<recipes::ScanResult, AppError> {
    let conn = database::init_global_db()?;
    recipes::scan_all_recipes(&conn)
}

/// Synchronize the recipe index in the background (async).
/// Emits "recipes:indexed" event when complete with ScanResult payload.
#[tauri::command]
pub async fn sync_recipe_index_async(app: AppHandle) -> Result<(), AppError> {
    // Spawn background task
    tauri::async_runtime::spawn(async move {
        let result = match database::init_global_db() {
            Ok(conn) => recipes::scan_all_recipes(&conn),
            Err(e) => Err(e),
        };
        
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
pub fn search_recipes(query: String, limit: Option<i32>) -> Result<Vec<recipes::RecipeMeta>, AppError> {
    let conn = database::init_global_db()?;
    recipes::search_recipes(&conn, &query, limit)
}

/// List recipes with optional filtering.
#[tauri::command]
pub fn list_indexed_recipes(
    source: Option<String>,
    category: Option<String>,
    limit: Option<i32>,
) -> Result<Vec<recipes::RecipeMeta>, AppError> {
    let conn = database::init_global_db()?;
    
    let filter = recipes::RecipeFilter {
        source: source.map(|s| recipes::RecipeSource::from_str(&s)),
        category,
        tags: None,
        limit,
    };
    
    recipes::list_recipes(&conn, filter)
}

/// Get a single recipe by ID.
#[tauri::command]
pub fn get_indexed_recipe(id: String) -> Result<Option<recipes::RecipeMeta>, AppError> {
    let conn = database::init_global_db()?;
    recipes::get_recipe_by_id(&conn, &id)
}

// ============================================
// Metadata Commands
// ============================================

/// Get all unique categories from indexed recipes.
#[tauri::command]
pub fn get_recipe_categories() -> Result<Vec<String>, AppError> {
    let conn = database::init_global_db()?;
    recipes::get_all_categories(&conn)
}

/// Get all unique tags from indexed recipes.
#[tauri::command]
pub fn get_recipe_tags() -> Result<Vec<String>, AppError> {
    let conn = database::init_global_db()?;
    recipes::get_all_tags(&conn)
}

// ============================================
// Manifest Loading Commands
// ============================================

/// Get the full recipe manifest with all $ref resolved.
/// Used for on-demand loading when user selects a recipe.
#[tauri::command]
pub fn get_recipe_manifest(
    source: String,
    path: String,
) -> Result<serde_json::Value, AppError> {
    let source = recipes::RecipeSource::from_str(&source);
    recipes::get_recipe_manifest(&source, &path)
}

/// Get recipe manifest by ID (looks up source and path from index).
#[tauri::command]
pub fn get_recipe_manifest_by_id(id: String) -> Result<serde_json::Value, AppError> {
    let conn = database::init_global_db()?;
    
    let meta = recipes::get_recipe_by_id(&conn, &id)?
        .ok_or_else(|| AppError::NotFound(format!("Recipe not found: {}", id)))?;
    
    recipes::get_recipe_manifest(&meta.source, &meta.path)
}

// ============================================
// Index Management Commands
// ============================================

/// Clear all recipes from the index.
/// Does NOT delete the actual recipe files.
#[tauri::command]
pub fn clear_recipe_index() -> Result<u32, AppError> {
    let conn = database::init_global_db()?;
    
    // First clear tags (foreign key constraint)
    conn.execute("DELETE FROM recipe_tags", [])
        .map_err(|e| AppError::Database(format!("Failed to clear recipe_tags: {}", e)))?;
    
    // Then clear main index
    let deleted = conn.execute("DELETE FROM recipe_index", [])
        .map_err(|e| AppError::Database(format!("Failed to clear recipe_index: {}", e)))?;
    
    // Rebuild FTS index
    conn.execute("INSERT INTO recipe_fts(recipe_fts) VALUES('rebuild')", [])
        .map_err(|e| AppError::Database(format!("Failed to rebuild FTS: {}", e)))?;
    
    log::info!("Cleared recipe index: {} recipes removed", deleted);
    Ok(deleted as u32)
}

/// Get the total count of indexed recipes.
#[tauri::command]
pub fn get_recipe_count() -> Result<u32, AppError> {
    let conn = database::init_global_db()?;
    
    let count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM recipe_index",
        [],
        |row| row.get(0)
    ).map_err(|e| AppError::Database(format!("Failed to count recipes: {}", e)))?;
    
    Ok(count as u32)
}
