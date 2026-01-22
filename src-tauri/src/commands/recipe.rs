use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use ts_rs::TS;

use crate::error::AppError;

// =============================================================================
// Types
// =============================================================================

/// File system entry (folder or recipe)
#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(tag = "type")]
pub enum RecipeEntry {
    #[serde(rename = "folder")]
    Folder {
        name: String,
        path: String,
    },
    #[serde(rename = "recipe")]
    Recipe {
        id: String,
        path: String,
        name: String,
        description: Option<String>,
        author: Option<String>,
        icon: Option<String>,
        cover: Option<String>,
    },
}

/// Directory listing result
#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct DirectoryListing {
    pub path: String,
    pub entries: Vec<RecipeEntry>,
}

/// File tree node for Mini-IDE
#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileNode>>,
}

// =============================================================================
// Helper Functions
// =============================================================================

/// Get the recipes base directory: ~/.synnia/recipes/
fn get_recipes_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    let config_dir = app
        .path()
        .config_dir()
        .map_err(|e| AppError::Io(format!("Failed to get config dir: {}", e)))?;
    
    let recipes_dir = config_dir.join("synnia").join("recipes");
    
    // Ensure directory exists
    if !recipes_dir.exists() {
        fs::create_dir_all(&recipes_dir)?;
    }
    
    Ok(recipes_dir)
}

/// Resolve a subpath within the recipes directory (with security check)
fn resolve_recipe_path(app: &AppHandle, subpath: Option<&str>) -> Result<PathBuf, AppError> {
    let base = get_recipes_dir(app)?;
    
    let target = match subpath {
        Some(p) if !p.is_empty() => base.join(p),
        _ => base.clone(),
    };
    
    // Security: ensure target is within base directory
    let canonical_base = base.canonicalize().unwrap_or(base.clone());
    let canonical_target = target.canonicalize().unwrap_or(target.clone());
    
    if !canonical_target.starts_with(&canonical_base) {
        return Err(AppError::Io("Path traversal attempt detected".to_string()));
    }
    
    Ok(target)
}

/// Parse manifest.yaml to extract metadata
fn parse_manifest_metadata(manifest_path: &Path) -> Option<(String, Option<String>, Option<String>, Option<String>, Option<String>)> {
    let content = fs::read_to_string(manifest_path).ok()?;
    
    // Simple YAML parsing for specific fields
    let mut name = None;
    let mut description = None;
    let mut author = None;
    let mut icon = None;
    let mut cover = None;
    
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("name:") {
            name = Some(trimmed.trim_start_matches("name:").trim().trim_matches('"').trim_matches('\'').to_string());
        } else if trimmed.starts_with("description:") {
            description = Some(trimmed.trim_start_matches("description:").trim().trim_matches('"').trim_matches('\'').to_string());
        } else if trimmed.starts_with("author:") {
            author = Some(trimmed.trim_start_matches("author:").trim().trim_matches('"').trim_matches('\'').to_string());
        } else if trimmed.starts_with("icon:") {
            icon = Some(trimmed.trim_start_matches("icon:").trim().trim_matches('"').trim_matches('\'').to_string());
        } else if trimmed.starts_with("cover:") {
            cover = Some(trimmed.trim_start_matches("cover:").trim().trim_matches('"').trim_matches('\'').to_string());
        }
    }
    
    name.map(|n| (n, description, author, icon, cover))
}

/// Build file tree recursively
fn build_file_tree(dir: &Path, base_path: &Path) -> Result<Vec<FileNode>, AppError> {
    let mut nodes = Vec::new();
    
    let entries = fs::read_dir(dir)?;
    
    for entry in entries {
        let entry = entry?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        
        // Skip hidden files
        if name.starts_with('.') {
            continue;
        }
        
        let relative_path = path
            .strip_prefix(base_path)
            .unwrap_or(&path)
            .to_string_lossy()
            .to_string();
        
        if path.is_dir() {
            let children = build_file_tree(&path, base_path)?;
            nodes.push(FileNode {
                name,
                path: relative_path,
                is_dir: true,
                children: Some(children),
            });
        } else {
            nodes.push(FileNode {
                name,
                path: relative_path,
                is_dir: false,
                children: None,
            });
        }
    }
    
    // Sort: directories first, then alphabetically
    nodes.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });
    
    Ok(nodes)
}

// =============================================================================
// Tauri Commands - Directory Listing
// =============================================================================

/// List contents of a directory (folders and recipes)
#[tauri::command]
pub fn list_recipe_directory(
    subpath: Option<String>,
    app: AppHandle,
) -> Result<DirectoryListing, AppError> {
    let dir_path = resolve_recipe_path(&app, subpath.as_deref())?;
    
    if !dir_path.exists() {
        fs::create_dir_all(&dir_path)?;
    }
    
    let mut entries = Vec::new();
    
    let read_dir = fs::read_dir(&dir_path)?;
    
    for entry in read_dir {
        let entry = entry?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        
        // Skip hidden files/folders
        if name.starts_with('.') {
            continue;
        }
        
        if path.is_dir() {
            // Check if it's a recipe (has manifest.yaml) or a folder
            let manifest_path = path.join("manifest.yaml");
            
            if manifest_path.exists() {
                // It's a recipe
                let relative_path = match &subpath {
                    Some(p) if !p.is_empty() => format!("{}/{}", p, name),
                    _ => name.clone(),
                };
                
                if let Some((recipe_name, description, author, icon, cover)) = parse_manifest_metadata(&manifest_path) {
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
                // It's a folder
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
    
    // Sort: folders first, then recipes alphabetically
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
// Tauri Commands - File Tree (Mini-IDE)
// =============================================================================

/// Get file tree for a specific recipe
#[tauri::command]
pub fn get_recipe_file_tree(
    recipe_path: String,
    app: AppHandle,
) -> Result<Vec<FileNode>, AppError> {
    let dir_path = resolve_recipe_path(&app, Some(&recipe_path))?;
    
    if !dir_path.exists() {
        return Err(AppError::NotFound(format!("Recipe not found: {}", recipe_path)));
    }
    
    build_file_tree(&dir_path, &dir_path)
}

// =============================================================================
// Tauri Commands - File Operations
// =============================================================================

/// Read a file within a recipe directory
#[tauri::command]
pub fn read_recipe_file(
    recipe_path: String,
    file_path: String,
    app: AppHandle,
) -> Result<String, AppError> {
    let base = resolve_recipe_path(&app, Some(&recipe_path))?;
    let file = base.join(&file_path);
    
    // Security check
    let canonical_base = base.canonicalize().unwrap_or(base.clone());
    let canonical_file = file.canonicalize().map_err(|_| {
        AppError::NotFound(format!("File not found: {}", file_path))
    })?;
    
    if !canonical_file.starts_with(&canonical_base) {
        return Err(AppError::Io("Path traversal attempt detected".to_string()));
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
    let base = resolve_recipe_path(&app, Some(&recipe_path))?;
    let file = base.join(&file_path);
    
    // Security check (for existing files)
    let canonical_base = base.canonicalize().unwrap_or(base.clone());
    if file.exists() {
        let canonical_file = file.canonicalize().unwrap_or(file.clone());
        if !canonical_file.starts_with(&canonical_base) {
            return Err(AppError::Io("Path traversal attempt detected".to_string()));
        }
    } else {
        // For new files, check that parent is within base
        if let Some(parent) = file.parent() {
            if !parent.starts_with(&base) {
                return Err(AppError::Io("Path traversal attempt detected".to_string()));
            }
            // Create parent directories if needed
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
    let base = resolve_recipe_path(&app, Some(&recipe_path))?;
    let file = base.join(&file_path);
    
    if file.exists() {
        return Err(AppError::Io(format!("File already exists: {}", file_path)));
    }
    
    // Create parent directories if needed
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
    let base = resolve_recipe_path(&app, Some(&recipe_path))?;
    let file = base.join(&file_path);
    
    // Security check
    let canonical_base = base.canonicalize().unwrap_or(base.clone());
    let canonical_file = file.canonicalize().map_err(|_| {
        AppError::NotFound(format!("File not found: {}", file_path))
    })?;
    
    if !canonical_file.starts_with(&canonical_base) {
        return Err(AppError::Io("Path traversal attempt detected".to_string()));
    }
    
    // Prevent deleting manifest.yaml
    if file_path == "manifest.yaml" {
        return Err(AppError::Io("Cannot delete manifest.yaml".to_string()));
    }
    
    if file.is_dir() {
        fs::remove_dir_all(&file)?;
    } else {
        fs::remove_file(&file)?;
    }
    
    Ok(())
}

// =============================================================================
// Tauri Commands - Recipe CRUD
// =============================================================================

/// Create a new recipe with default manifest
#[tauri::command]
pub fn create_recipe(
    parent_path: Option<String>,
    recipe_id: String,
    app: AppHandle,
) -> Result<String, AppError> {
    let base = resolve_recipe_path(&app, parent_path.as_deref())?;
    let recipe_dir = base.join(&recipe_id);
    
    if recipe_dir.exists() {
        return Err(AppError::Io(format!("Recipe already exists: {}", recipe_id)));
    }
    
    fs::create_dir_all(&recipe_dir)?;
    
    // Create default manifest.yaml
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
    let base = resolve_recipe_path(&app, parent_path.as_deref())?;
    let folder_dir = base.join(&folder_name);
    
    if folder_dir.exists() {
        return Err(AppError::Io(format!("Folder already exists: {}", folder_name)));
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
    let target = resolve_recipe_path(&app, Some(&recipe_path))?;
    
    if !target.exists() {
        return Err(AppError::NotFound(format!("Path not found: {}", recipe_path)));
    }
    
    fs::remove_dir_all(&target)?;
    Ok(())
}

/// Get the recipes base directory path (for debugging)
#[tauri::command]
pub fn get_recipes_base_path(app: AppHandle) -> Result<String, AppError> {
    let path = get_recipes_dir(&app)?;
    Ok(path.to_string_lossy().to_string())
}
