//! Recipe management Tauri commands.

use std::fs;
use tauri::AppHandle;

use crate::core::AppError;
use super::types::*;
use super::persistence;

// =============================================================================
// Directory Listing
// =============================================================================

/// List contents of a directory (folders and recipes)
#[tauri::command]
pub fn list_recipe_directory(
    subpath: Option<String>,
    app: AppHandle,
) -> Result<DirectoryListing, AppError> {
    let dir_path = persistence::resolve_recipe_path(&app, subpath.as_deref())?;
    
    if !dir_path.exists() {
        fs::create_dir_all(&dir_path)?;
    }
    
    let mut entries = Vec::new();
    
    let read_dir = fs::read_dir(&dir_path)?;
    
    for entry in read_dir {
        let entry = entry?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        
        if name.starts_with('.') {
            continue;
        }
        
        if path.is_dir() {
            let manifest_path = path.join("manifest.yaml");
            
            if manifest_path.exists() {
                let relative_path = match &subpath {
                    Some(p) if !p.is_empty() => format!("{}/{}", p, name),
                    _ => name.clone(),
                };
                
                if let Some((recipe_name, description, author, icon, cover)) = persistence::parse_manifest_metadata(&manifest_path) {
                    entries.push(RecipeEntry::Recipe {
                        id: name,
                        path: relative_path,
                        name: recipe_name,
                        description,
                        author,
                        icon,
                        cover,
                    });
                }
            } else {
                let relative_path = match &subpath {
                    Some(p) if !p.is_empty() => format!("{}/{}", p, name),
                    _ => name.clone(),
                };
                
                entries.push(RecipeEntry::Folder {
                    name,
                    path: relative_path,
                });
            }
        }
    }
    
    entries.sort_by(|a, b| {
        match (a, b) {
            (RecipeEntry::Folder { name: a_name, .. }, RecipeEntry::Folder { name: b_name, .. }) => {
                a_name.to_lowercase().cmp(&b_name.to_lowercase())
            }
            (RecipeEntry::Recipe { name: a_name, .. }, RecipeEntry::Recipe { name: b_name, .. }) => {
                a_name.to_lowercase().cmp(&b_name.to_lowercase())
            }
            (RecipeEntry::Folder { .. }, RecipeEntry::Recipe { .. }) => std::cmp::Ordering::Less,
            (RecipeEntry::Recipe { .. }, RecipeEntry::Folder { .. }) => std::cmp::Ordering::Greater,
        }
    });
    
    Ok(DirectoryListing {
        path: subpath.unwrap_or_default(),
        entries,
    })
}

// =============================================================================
// File Tree (Mini-IDE)
// =============================================================================

/// Get file tree for a specific recipe
#[tauri::command]
pub fn get_recipe_file_tree(
    recipe_path: String,
    app: AppHandle,
) -> Result<Vec<FileNode>, AppError> {
    let dir_path = persistence::resolve_recipe_path(&app, Some(&recipe_path))?;
    
    if !dir_path.exists() {
        return Err(AppError::NotFound(format!("Recipe not found: {}", recipe_path)));
    }
    
    persistence::build_file_tree(&dir_path, &dir_path)
}

// =============================================================================
// File Operations
// =============================================================================

/// Read a file within a recipe directory
#[tauri::command]
pub fn read_recipe_file(
    recipe_path: String,
    file_path: String,
    app: AppHandle,
) -> Result<String, AppError> {
    let base = persistence::resolve_recipe_path(&app, Some(&recipe_path))?;
    let file = base.join(&file_path);
    
    let canonical_base = base.canonicalize().unwrap_or(base.clone());
    let canonical_file = file.canonicalize().map_err(|_| {
        AppError::NotFound(format!("File not found: {}", file_path))
    })?;
    
    if !canonical_file.starts_with(&canonical_base) {
        return Err(AppError::Validation("Path traversal attempt detected".to_string()));
    }
    
    fs::read_to_string(&file).map_err(|e| AppError::Io(e.to_string()))
}

/// Write content to a file within a recipe directory
#[tauri::command]
pub fn write_recipe_file(
    recipe_path: String,
    file_path: String,
    content: String,
    app: AppHandle,
) -> Result<(), AppError> {
    let base = persistence::resolve_recipe_path(&app, Some(&recipe_path))?;
    let file = base.join(&file_path);
    
    let canonical_base = base.canonicalize().unwrap_or(base.clone());
    if file.exists() {
        let canonical_file = file.canonicalize().unwrap_or(file.clone());
        if !canonical_file.starts_with(&canonical_base) {
            return Err(AppError::Validation("Path traversal attempt detected".to_string()));
        }
    } else {
        if let Some(parent) = file.parent() {
            if !parent.starts_with(&base) {
                return Err(AppError::Validation("Path traversal attempt detected".to_string()));
            }
            fs::create_dir_all(parent)?;
        }
    }
    
    fs::write(&file, content)?;
    Ok(())
}

/// Create a new file within a recipe directory
#[tauri::command]
pub fn create_recipe_file(
    recipe_path: String,
    file_path: String,
    app: AppHandle,
) -> Result<(), AppError> {
    let base = persistence::resolve_recipe_path(&app, Some(&recipe_path))?;
    let file = base.join(&file_path);
    
    if file.exists() {
        return Err(AppError::Validation(format!("File already exists: {}", file_path)));
    }
    
    if let Some(parent) = file.parent() {
        fs::create_dir_all(parent)?;
    }
    
    fs::write(&file, "")?;
    Ok(())
}

/// Delete a file within a recipe directory
#[tauri::command]
pub fn delete_recipe_file(
    recipe_path: String,
    file_path: String,
    app: AppHandle,
) -> Result<(), AppError> {
    let base = persistence::resolve_recipe_path(&app, Some(&recipe_path))?;
    let file = base.join(&file_path);
    
    let canonical_base = base.canonicalize().unwrap_or(base.clone());
    let canonical_file = file.canonicalize().map_err(|_| {
        AppError::NotFound(format!("File not found: {}", file_path))
    })?;
    
    if !canonical_file.starts_with(&canonical_base) {
        return Err(AppError::Validation("Path traversal attempt detected".to_string()));
    }
    
    if file_path == "manifest.yaml" {
        return Err(AppError::Validation("Cannot delete manifest.yaml".to_string()));
    }
    
    if file.is_dir() {
        fs::remove_dir_all(&file)?;
    } else {
        fs::remove_file(&file)?;
    }
    
    Ok(())
}

// =============================================================================
// Recipe CRUD
// =============================================================================

/// Create a new recipe with default manifest
#[tauri::command]
pub fn create_recipe(
    parent_path: Option<String>,
    recipe_id: String,
    app: AppHandle,
) -> Result<String, AppError> {
    let base = persistence::resolve_recipe_path(&app, parent_path.as_deref())?;
    let recipe_dir = base.join(&recipe_id);
    
    if recipe_dir.exists() {
        return Err(AppError::Validation(format!("Recipe already exists: {}", recipe_id)));
    }
    
    fs::create_dir_all(&recipe_dir)?;
    
    let default_manifest = format!(
        r#"version: 1

id: {}
name: New Recipe
description: A new recipe

executor:
  type: agent
  model:
    category: llm
    defaultParams:
      temperature: 0.7
  prompt:
    user: "{{{{prompt}}}}"

input:
  - key: prompt
    label: Prompt
    type: string
    widget: textarea
    required: true

output:
  node: form
  title: Result
"#,
        recipe_id
    );
    
    let manifest_path = recipe_dir.join("manifest.yaml");
    fs::write(&manifest_path, default_manifest)?;
    
    let relative_path = match &parent_path {
        Some(p) if !p.is_empty() => format!("{}/{}", p, recipe_id),
        _ => recipe_id,
    };
    
    Ok(relative_path)
}

/// Create a new folder
#[tauri::command]
pub fn create_recipe_folder(
    parent_path: Option<String>,
    folder_name: String,
    app: AppHandle,
) -> Result<String, AppError> {
    let base = persistence::resolve_recipe_path(&app, parent_path.as_deref())?;
    let folder_dir = base.join(&folder_name);
    
    if folder_dir.exists() {
        return Err(AppError::Validation(format!("Folder already exists: {}", folder_name)));
    }
    
    fs::create_dir_all(&folder_dir)?;
    
    let relative_path = match &parent_path {
        Some(p) if !p.is_empty() => format!("{}/{}", p, folder_name),
        _ => folder_name,
    };
    
    Ok(relative_path)
}

/// Delete a recipe or folder
#[tauri::command]
pub fn delete_recipe(
    recipe_path: String,
    app: AppHandle,
) -> Result<(), AppError> {
    let target = persistence::resolve_recipe_path(&app, Some(&recipe_path))?;
    
    if !target.exists() {
        return Err(AppError::NotFound(format!("Path not found: {}", recipe_path)));
    }
    
    fs::remove_dir_all(&target)?;
    Ok(())
}

/// Get the recipes base directory path
#[tauri::command]
pub fn get_recipes_base_path(app: AppHandle) -> Result<String, AppError> {
    let path = persistence::get_recipes_dir(&app)?;
    Ok(path.to_string_lossy().to_string())
}
