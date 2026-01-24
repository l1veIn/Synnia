//! Recipe file system operations.

use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

use crate::core::AppError;
use super::types::FileNode;

/// Get the recipes base directory: ~/.synnia/recipes/
pub fn get_recipes_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    let config_dir = app
        .path()
        .config_dir()
        .map_err(|e| AppError::Io(format!("Failed to get config dir: {}", e)))?;
    
    let recipes_dir = config_dir.join("synnia").join("recipes");
    
    if !recipes_dir.exists() {
        fs::create_dir_all(&recipes_dir)?;
    }
    
    Ok(recipes_dir)
}

/// Resolve a subpath within the recipes directory (with security check)
pub fn resolve_recipe_path(app: &AppHandle, subpath: Option<&str>) -> Result<PathBuf, AppError> {
    let base = get_recipes_dir(app)?;
    
    let target = match subpath {
        Some(p) if !p.is_empty() => base.join(p),
        _ => base.clone(),
    };
    
    let canonical_base = base.canonicalize().unwrap_or(base.clone());
    let canonical_target = target.canonicalize().unwrap_or(target.clone());
    
    if !canonical_target.starts_with(&canonical_base) {
        return Err(AppError::Validation("Path traversal attempt detected".to_string()));
    }
    
    Ok(target)
}

/// Parse manifest.yaml to extract metadata
pub fn parse_manifest_metadata(manifest_path: &Path) -> Option<(String, Option<String>, Option<String>, Option<String>, Option<String>)> {
    let content = fs::read_to_string(manifest_path).ok()?;
    
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
pub fn build_file_tree(dir: &Path, base_path: &Path) -> Result<Vec<FileNode>, AppError> {
    let mut nodes = Vec::new();
    
    let entries = fs::read_dir(dir)?;
    
    for entry in entries {
        let entry = entry?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        
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
    
    nodes.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });
    
    Ok(nodes)
}
