//! Recipe index management.
//!
//! Indexes recipes from multiple sources with FTS5 search support.

use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::fs;

use crate::core::AppError;
use crate::infrastructure::hash;

/// Recipe source type
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RecipeSource {
    Builtin,
    User,
    Marketplace,
}

impl RecipeSource {
    pub fn as_str(&self) -> &'static str {
        match self {
            RecipeSource::Builtin => "builtin",
            RecipeSource::User => "user",
            RecipeSource::Marketplace => "marketplace",
        }
    }
    
    pub fn from_str(s: &str) -> Self {
        match s {
            "builtin" => RecipeSource::Builtin,
            "marketplace" => RecipeSource::Marketplace,
            _ => RecipeSource::User,
        }
    }
}

/// Recipe metadata from index
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecipeMeta {
    pub id: String,
    pub source: RecipeSource,
    pub path: String,
    pub name: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub icon: Option<String>,
    pub author: Option<String>,
    pub version: i32,
    pub cover: Option<String>,
    pub tags: Vec<String>,
}

/// Recipe filter for queries
#[derive(Debug, Default)]
pub struct RecipeFilter {
    pub source: Option<RecipeSource>,
    pub category: Option<String>,
    pub tags: Option<Vec<String>>,
    pub limit: Option<i32>,
}

/// Scan result
#[derive(Debug, Clone, Serialize)]
pub struct ScanResult {
    pub added: i32,
    pub updated: i32,
    pub removed: i32,
}

/// Resolve logical path to physical path based on source.
pub fn resolve_recipe_path(source: &RecipeSource, relative_path: &str) -> PathBuf {
    match source {
        RecipeSource::User => {
            get_user_recipes_dir().join(relative_path)
        }
        RecipeSource::Marketplace => {
            dirs::home_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join(".synnia/marketplace")
                .join(relative_path)
        }
        RecipeSource::Builtin => {
            get_builtin_recipes_dir().join(relative_path)
        }
    }
}

/// Get the user recipes directory from settings.
pub fn get_user_recipes_dir() -> PathBuf {
    // Try to get from database settings
    if let Ok(conn) = crate::global::database::init_global_db() {
        if let Ok(Some(path)) = crate::global::settings::get_setting(&conn, crate::global::database::SETTING_USER_RECIPES_DIR) {
            return crate::global::database::expand_path(&path);
        }
    }
    // Fallback to default
    crate::global::database::expand_path(crate::global::database::DEFAULT_USER_RECIPES_DIR)
}

/// Get the builtin recipes directory.
/// In dev mode: src/features/recipes/packages (relative to project root)
/// In production: Tauri resource directory
pub fn get_builtin_recipes_dir() -> PathBuf {
    // Check for dev environment marker
    let dev_path = PathBuf::from("src/features/recipes/packages");
    if dev_path.exists() {
        return dev_path;
    }
    
    // Check parent paths for monorepo structure
    let alt_dev_path = PathBuf::from("../src/features/recipes/packages");
    if alt_dev_path.exists() {
        return alt_dev_path;
    }
    
    // Production: use Tauri resource dir (will be set at runtime)
    // For now, fallback to a placeholder
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".synnia/builtin")
}

/// Scan user recipes directory and update index.
pub fn scan_user_recipes(conn: &Connection) -> Result<ScanResult, AppError> {
    let recipes_dir = get_user_recipes_dir();
    
    if !recipes_dir.exists() {
        return Ok(ScanResult { added: 0, updated: 0, removed: 0 });
    }
    
    let mut added = 0;
    let mut updated = 0;
    let mut found_paths: Vec<String> = Vec::new();
    
    // Scan directories
    for entry in fs::read_dir(&recipes_dir)
        .map_err(|e| AppError::Io(format!("Failed to read recipes dir: {}", e)))? 
    {
        let entry = entry.map_err(|e| AppError::Io(e.to_string()))?;
        let path = entry.path();
        
        if path.is_dir() {
            let manifest_path = path.join("manifest.yaml");
            if manifest_path.exists() {
                let relative_path = path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();
                
                found_paths.push(relative_path.clone());
                
                match index_recipe(conn, &RecipeSource::User, &relative_path, &manifest_path) {
                    Ok(IndexResult::Added) => added += 1,
                    Ok(IndexResult::Updated) => updated += 1,
                    Ok(IndexResult::Unchanged) => {}
                    Err(e) => {
                        log::warn!("Failed to index recipe {}: {}", relative_path, e);
                    }
                }
            }
        }
    }
    
    // Remove recipes that no longer exist
    let removed = remove_missing_recipes(conn, &RecipeSource::User, &found_paths)?;
    
    Ok(ScanResult { added, updated, removed })
}

/// Scan builtin recipes directory and update index.
pub fn scan_builtin_recipes(conn: &Connection) -> Result<ScanResult, AppError> {
    let recipes_dir = get_builtin_recipes_dir();
    log::info!("Scanning builtin recipes at: {:?}", recipes_dir);
    
    if !recipes_dir.exists() {
        log::warn!("Builtin recipes directory not found: {:?}", recipes_dir);
        return Ok(ScanResult { added: 0, updated: 0, removed: 0 });
    }
    
    let mut added = 0;
    let mut updated = 0;
    let mut found_paths: Vec<String> = Vec::new();
    
    // Recursively scan for manifest.yaml files
    scan_recipes_recursive(conn, &recipes_dir, &recipes_dir, &RecipeSource::Builtin, &mut added, &mut updated, &mut found_paths)?;
    
    // Remove recipes that no longer exist
    let removed = remove_missing_recipes(conn, &RecipeSource::Builtin, &found_paths)?;
    
    log::info!("Builtin scan complete: added={}, updated={}, removed={}", added, updated, removed);
    Ok(ScanResult { added, updated, removed })
}

/// Recursively scan a directory for recipes.
fn scan_recipes_recursive(
    conn: &Connection,
    base_dir: &Path,
    current_dir: &Path,
    source: &RecipeSource,
    added: &mut i32,
    updated: &mut i32,
    found_paths: &mut Vec<String>,
) -> Result<(), AppError> {
    for entry in fs::read_dir(current_dir)
        .map_err(|e| AppError::Io(format!("Failed to read dir {:?}: {}", current_dir, e)))? 
    {
        let entry = entry.map_err(|e| AppError::Io(e.to_string()))?;
        let path = entry.path();
        
        if path.is_dir() {
            let manifest_path = path.join("manifest.yaml");
            if manifest_path.exists() {
                // This is a recipe directory
                let relative_path = path.strip_prefix(base_dir)
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_else(|_| path.file_name().unwrap_or_default().to_string_lossy().to_string());
                
                found_paths.push(relative_path.clone());
                
                match index_recipe(conn, source, &relative_path, &manifest_path) {
                    Ok(IndexResult::Added) => *added += 1,
                    Ok(IndexResult::Updated) => *updated += 1,
                    Ok(IndexResult::Unchanged) => {}
                    Err(e) => {
                        log::warn!("Failed to index recipe {}: {}", relative_path, e);
                    }
                }
            } else {
                // Not a recipe, recurse into subdirectory
                scan_recipes_recursive(conn, base_dir, &path, source, added, updated, found_paths)?;
            }
        }
    }
    Ok(())
}

/// Scan all recipes (user + builtin) and update index.
pub fn scan_all_recipes(conn: &Connection) -> Result<ScanResult, AppError> {
    let user_result = scan_user_recipes(conn)?;
    let builtin_result = scan_builtin_recipes(conn)?;
    
    Ok(ScanResult {
        added: user_result.added + builtin_result.added,
        updated: user_result.updated + builtin_result.updated,
        removed: user_result.removed + builtin_result.removed,
    })
}

enum IndexResult {
    Added,
    Updated,
    Unchanged,
}

/// Index a single recipe from its manifest file.
fn index_recipe(
    conn: &Connection,
    source: &RecipeSource,
    relative_path: &str,
    manifest_path: &Path,
) -> Result<IndexResult, AppError> {
    // Read and parse manifest
    let manifest_content = fs::read_to_string(manifest_path)
        .map_err(|e| AppError::Io(format!("Failed to read manifest: {}", e)))?;
    
    let manifest: serde_yaml::Value = serde_yaml::from_str(&manifest_content)
        .map_err(|e| AppError::Serialization(format!("Failed to parse manifest: {}", e)))?;
    
    // Compute content hash
    let content_hash = hash::compute_content_hash(&manifest_content);
    
    // Check if already indexed with same hash
    let existing: Option<String> = conn.query_row(
        "SELECT content_hash FROM recipe_index WHERE source = ?1 AND path = ?2",
        params![source.as_str(), relative_path],
        |row| row.get(0)
    ).ok();
    
    if existing.as_ref() == Some(&content_hash) {
        return Ok(IndexResult::Unchanged);
    }
    
    // Extract metadata
    let id = manifest.get("id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| format!("{}:{}", source.as_str(), relative_path));
    
    let name = manifest.get("name")
        .and_then(|v| v.as_str())
        .unwrap_or(relative_path)
        .to_string();
    
    let description = manifest.get("description").and_then(|v| v.as_str()).map(|s| s.to_string());
    let category = manifest.get("category").and_then(|v| v.as_str()).map(|s| s.to_string());
    let icon = manifest.get("icon").and_then(|v| v.as_str()).map(|s| s.to_string());
    let author = manifest.get("author").and_then(|v| v.as_str()).map(|s| s.to_string());
    let version = manifest.get("version").and_then(|v| v.as_i64()).unwrap_or(1) as i32;
    let cover = manifest.get("cover").and_then(|v| v.as_str()).map(|s| s.to_string());
    
    let tags: Vec<String> = manifest.get("tags")
        .and_then(|v| v.as_sequence())
        .map(|seq| seq.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();
    
    let now = chrono::Utc::now().timestamp_millis();
    let is_update = existing.is_some();
    
    // Check for ID conflict (different source/path but same ID)
    let id_conflict: Option<(String, String)> = conn.query_row(
        "SELECT source, path FROM recipe_index WHERE id = ?1 AND NOT (source = ?2 AND path = ?3)",
        params![&id, source.as_str(), relative_path],
        |row| Ok((row.get(0)?, row.get(1)?))
    ).ok();
    
    if let Some((existing_source, existing_path)) = id_conflict {
        log::warn!(
            "Recipe ID conflict: '{}' already exists at {}:{}, skipping {}:{}",
            id, existing_source, existing_path, source.as_str(), relative_path
        );
        return Err(AppError::Validation(format!(
            "Recipe ID '{}' already exists at {}:{}",
            id, existing_source, existing_path
        )));
    }
    
    // Upsert recipe
    conn.execute(
        "INSERT INTO recipe_index (id, source, path, name, description, category, icon, author, version, cover, content_hash, indexed_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
         ON CONFLICT(source, path) DO UPDATE SET
             id = excluded.id,
             name = excluded.name,
             description = excluded.description,
             category = excluded.category,
             icon = excluded.icon,
             author = excluded.author,
             version = excluded.version,
             cover = excluded.cover,
             content_hash = excluded.content_hash,
             updated_at = excluded.updated_at",
        params![id, source.as_str(), relative_path, name, description, category, icon, author, version, cover, content_hash, now, now]
    ).map_err(|e| AppError::Database(format!("Failed to index recipe: {}", e)))?;
    
    // Update tags
    conn.execute(
        "DELETE FROM recipe_tags WHERE recipe_id = ?1",
        params![id]
    ).map_err(|e| AppError::Database(format!("Failed to clear tags: {}", e)))?;
    
    for tag in tags {
        conn.execute(
            "INSERT OR IGNORE INTO recipe_tags (recipe_id, tag) VALUES (?1, ?2)",
            params![id, tag]
        ).map_err(|e| AppError::Database(format!("Failed to insert tag: {}", e)))?;
    }
    
    if is_update {
        Ok(IndexResult::Updated)
    } else {
        Ok(IndexResult::Added)
    }
}

/// Remove recipes that are no longer present in the filesystem.
fn remove_missing_recipes(
    conn: &Connection,
    source: &RecipeSource,
    found_paths: &[String],
) -> Result<i32, AppError> {
    if found_paths.is_empty() {
        let removed = conn.execute(
            "DELETE FROM recipe_index WHERE source = ?1",
            params![source.as_str()]
        ).map_err(|e| AppError::Database(format!("Failed to remove recipes: {}", e)))?;
        return Ok(removed as i32);
    }
    
    // Build placeholders for IN clause
    let placeholders: Vec<String> = found_paths.iter().enumerate().map(|(i, _)| format!("?{}", i + 2)).collect();
    let sql = format!(
        "DELETE FROM recipe_index WHERE source = ?1 AND path NOT IN ({})",
        placeholders.join(", ")
    );
    
    // Store source string to avoid temporary value issues
    let source_str = source.as_str().to_string();
    let mut params_vec: Vec<&dyn rusqlite::ToSql> = vec![&source_str as &dyn rusqlite::ToSql];
    for p in found_paths {
        params_vec.push(p as &dyn rusqlite::ToSql);
    }
    
    let removed = conn.execute(&sql, params_vec.as_slice())
        .map_err(|e| AppError::Database(format!("Failed to remove missing recipes: {}", e)))?;
    
    Ok(removed as i32)
}

/// Search recipes using FTS5.
pub fn search_recipes(
    conn: &Connection, 
    query: &str, 
    limit: Option<i32>
) -> Result<Vec<RecipeMeta>, AppError> {
    let limit = limit.unwrap_or(50);
    
    // Escape FTS5 special characters
    let escaped_query = query.replace('"', "\"\"");
    let fts_query = format!("\"{}\"*", escaped_query);
    
    let mut stmt = conn.prepare(
        "SELECT r.id, r.source, r.path, r.name, r.description, r.category, r.icon, r.author, r.version, r.cover
         FROM recipe_index r
         JOIN recipe_fts f ON r.rowid = f.rowid
         WHERE recipe_fts MATCH ?1
         ORDER BY rank
         LIMIT ?2"
    ).map_err(|e| AppError::Database(format!("Failed to prepare search: {}", e)))?;
    
    let recipes: Vec<RecipeMeta> = stmt.query_map(params![fts_query, limit], |row| {
        Ok(RecipeMeta {
            id: row.get(0)?,
            source: RecipeSource::from_str(&row.get::<_, String>(1)?),
            path: row.get(2)?,
            name: row.get(3)?,
            description: row.get(4)?,
            category: row.get(5)?,
            icon: row.get(6)?,
            author: row.get(7)?,
            version: row.get(8)?,
            cover: row.get(9)?,
            tags: Vec::new(), // Loaded separately if needed
        })
    }).map_err(|e| AppError::Database(format!("Search failed: {}", e)))?
    .filter_map(|r| r.ok())
    .collect();
    
    Ok(recipes)
}

/// List recipes with optional filtering.
pub fn list_recipes(
    conn: &Connection, 
    filter: RecipeFilter
) -> Result<Vec<RecipeMeta>, AppError> {
    let limit = filter.limit.unwrap_or(100);
    
    let mut sql = String::from(
        "SELECT id, source, path, name, description, category, icon, author, version, cover FROM recipe_index WHERE 1=1"
    );
    
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    
    if let Some(source) = &filter.source {
        sql.push_str(&format!(" AND source = ?{}", params_vec.len() + 1));
        params_vec.push(Box::new(source.as_str().to_string()));
    }
    
    if let Some(category) = &filter.category {
        sql.push_str(&format!(" AND category = ?{}", params_vec.len() + 1));
        params_vec.push(Box::new(category.clone()));
    }
    
    sql.push_str(" ORDER BY name");
    sql.push_str(&format!(" LIMIT ?{}", params_vec.len() + 1));
    params_vec.push(Box::new(limit));
    
    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
    
    let mut stmt = conn.prepare(&sql)
        .map_err(|e| AppError::Database(format!("Failed to prepare query: {}", e)))?;
    
    let recipes: Vec<RecipeMeta> = stmt.query_map(params_refs.as_slice(), |row| {
        Ok(RecipeMeta {
            id: row.get(0)?,
            source: RecipeSource::from_str(&row.get::<_, String>(1)?),
            path: row.get(2)?,
            name: row.get(3)?,
            description: row.get(4)?,
            category: row.get(5)?,
            icon: row.get(6)?,
            author: row.get(7)?,
            version: row.get(8)?,
            cover: row.get(9)?,
            tags: Vec::new(),
        })
    }).map_err(|e| AppError::Database(format!("Query failed: {}", e)))?
    .filter_map(|r| r.ok())
    .collect();
    
    Ok(recipes)
}

/// Get a recipe by ID.
pub fn get_recipe_by_id(conn: &Connection, id: &str) -> Result<Option<RecipeMeta>, AppError> {
    let result = conn.query_row(
        "SELECT id, source, path, name, description, category, icon, author, version, cover
         FROM recipe_index WHERE id = ?1",
        params![id],
        |row| {
            Ok(RecipeMeta {
                id: row.get(0)?,
                source: RecipeSource::from_str(&row.get::<_, String>(1)?),
                path: row.get(2)?,
                name: row.get(3)?,
                description: row.get(4)?,
                category: row.get(5)?,
                icon: row.get(6)?,
                author: row.get(7)?,
                version: row.get(8)?,
                cover: row.get(9)?,
                tags: Vec::new(),
            })
        }
    );
    
    match result {
        Ok(mut meta) => {
            // Load tags
            meta.tags = get_recipe_tags(conn, &meta.id)?;
            Ok(Some(meta))
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(AppError::Database(format!("Failed to get recipe: {}", e))),
    }
}

/// Get tags for a recipe.
fn get_recipe_tags(conn: &Connection, recipe_id: &str) -> Result<Vec<String>, AppError> {
    let mut stmt = conn.prepare("SELECT tag FROM recipe_tags WHERE recipe_id = ?1 ORDER BY tag")
        .map_err(|e| AppError::Database(format!("Failed to prepare query: {}", e)))?;
    
    let tags = stmt.query_map(params![recipe_id], |row| row.get(0))
        .map_err(|e| AppError::Database(format!("Query failed: {}", e)))?
        .filter_map(|r| r.ok())
        .collect();
    
    Ok(tags)
}

/// Get all unique categories.
pub fn get_all_categories(conn: &Connection) -> Result<Vec<String>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT DISTINCT category FROM recipe_index WHERE category IS NOT NULL ORDER BY category"
    ).map_err(|e| AppError::Database(format!("Failed to prepare query: {}", e)))?;
    
    let categories = stmt.query_map([], |row| row.get(0))
        .map_err(|e| AppError::Database(format!("Query failed: {}", e)))?
        .filter_map(|r| r.ok())
        .collect();
    
    Ok(categories)
}

/// Get all unique tags.
pub fn get_all_tags(conn: &Connection) -> Result<Vec<String>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT DISTINCT tag FROM recipe_tags ORDER BY tag"
    ).map_err(|e| AppError::Database(format!("Failed to prepare query: {}", e)))?;
    
    let tags = stmt.query_map([], |row| row.get(0))
        .map_err(|e| AppError::Database(format!("Query failed: {}", e)))?
        .filter_map(|r| r.ok())
        .collect();
    
    Ok(tags)
}

// ============================================================================
// Manifest Loading with $ref Resolution
// ============================================================================

use std::collections::HashSet;

/// Get the full recipe manifest with $ref resolved.
/// This reads the manifest.yaml file and recursively resolves all $ref references.
pub fn get_recipe_manifest(
    source: &RecipeSource,
    relative_path: &str,
) -> Result<serde_json::Value, AppError> {
    let recipe_dir = resolve_recipe_path(source, relative_path);
    let manifest_path = recipe_dir.join("manifest.yaml");
    
    if !manifest_path.exists() {
        return Err(AppError::NotFound(format!(
            "Manifest not found: {}", manifest_path.display()
        )));
    }
    
    // Read manifest
    let manifest_content = fs::read_to_string(&manifest_path)
        .map_err(|e| AppError::Io(format!("Failed to read manifest: {}", e)))?;
    
    // Parse YAML
    let mut manifest: serde_yaml::Value = serde_yaml::from_str(&manifest_content)
        .map_err(|e| AppError::Serialization(format!("Failed to parse manifest: {}", e)))?;
    
    // Resolve $ref references
    let mut visited = HashSet::new();
    resolve_refs(&mut manifest, &recipe_dir, &mut visited)?;
    
    // Convert to JSON for frontend
    let json = serde_json::to_value(&manifest)
        .map_err(|e| AppError::Serialization(format!("Failed to convert to JSON: {}", e)))?;
    
    Ok(json)
}

/// Recursively resolve $ref references in a YAML value.
fn resolve_refs(
    value: &mut serde_yaml::Value,
    base_dir: &Path,
    visited: &mut HashSet<PathBuf>,
) -> Result<(), AppError> {
    match value {
        serde_yaml::Value::Mapping(map) => {
            // Check for $ref
            if let Some(serde_yaml::Value::String(ref_path)) = map.get(&serde_yaml::Value::String("$ref".to_string())) {
                let resolved_path = resolve_ref_path(base_dir, ref_path)?;
                
                // Check circular reference
                if visited.contains(&resolved_path) {
                    return Err(AppError::Validation(format!(
                        "Circular reference detected: {}", resolved_path.display()
                    )));
                }
                
                // Load referenced file
                let content = load_ref_file(&resolved_path)?;
                visited.insert(resolved_path.clone());
                
                // Get the directory of the referenced file for nested refs
                let ref_dir = resolved_path.parent().unwrap_or(base_dir);
                
                // Replace current value with loaded content
                *value = content;
                
                // Recursively resolve refs in loaded content
                resolve_refs(value, ref_dir, visited)?;
            } else {
                // Recursively process all values in the mapping
                for (_, v) in map.iter_mut() {
                    resolve_refs(v, base_dir, visited)?;
                }
            }
        }
        serde_yaml::Value::Sequence(seq) => {
            for item in seq.iter_mut() {
                resolve_refs(item, base_dir, visited)?;
            }
        }
        _ => {}
    }
    
    Ok(())
}

/// Resolve a $ref path. Supports:
/// - Relative paths: ./file.yaml, ../sibling/file.yaml
/// - Package references: @recipe-id/path/to/file.yaml
fn resolve_ref_path(base_dir: &Path, ref_path: &str) -> Result<PathBuf, AppError> {
    // Package reference: @recipe-id/path
    if ref_path.starts_with('@') {
        return resolve_package_ref(ref_path);
    }
    
    // Absolute path (should not happen, but handle it)
    if ref_path.starts_with('/') {
        return Ok(PathBuf::from(ref_path));
    }
    
    // Relative path
    let mut result = base_dir.to_path_buf();
    for part in ref_path.split('/') {
        if part == ".." {
            result.pop();
        } else if part != "." {
            result.push(part);
        }
    }
    Ok(result)
}

/// Resolve a package reference like @recipe-id/path/to/file.yaml
fn resolve_package_ref(ref_path: &str) -> Result<PathBuf, AppError> {
    // Parse @recipe-id/relative/path
    let without_at = ref_path.strip_prefix('@').unwrap();
    let (recipe_id, relative_path) = match without_at.find('/') {
        Some(idx) => (&without_at[..idx], &without_at[idx + 1..]),
        None => {
            return Err(AppError::Validation(format!(
                "Invalid package reference '{}': expected @recipe-id/path format",
                ref_path
            )));
        }
    };
    
    // Look up recipe in index
    let conn = crate::global::database::init_global_db()?;
    let (source_str, path): (String, String) = conn.query_row(
        "SELECT source, path FROM recipe_index WHERE id = ?1",
        [recipe_id],
        |row| Ok((row.get(0)?, row.get(1)?))
    ).map_err(|_| AppError::NotFound(format!(
        "Recipe '{}' not found in index (package reference: {})",
        recipe_id, ref_path
    )))?;
    
    // Convert source string to RecipeSource
    let source = RecipeSource::from_str(&source_str);
    
    // Build the full path
    let recipe_dir = resolve_recipe_path(&source, &path);
    let full_path = recipe_dir.join(relative_path);
    
    log::debug!("Resolved package ref '{}' -> {:?}", ref_path, full_path);
    Ok(full_path)
}

/// Load a referenced file, returning YAML or raw string for .md files.
fn load_ref_file(path: &Path) -> Result<serde_yaml::Value, AppError> {
    if !path.exists() {
        return Err(AppError::NotFound(format!(
            "Referenced file not found: {}", path.display()
        )));
    }
    
    let content = fs::read_to_string(path)
        .map_err(|e| AppError::Io(format!("Failed to read {}: {}", path.display(), e)))?;
    
    // For .md files, return as string
    if path.extension().map_or(false, |ext| ext == "md") {
        return Ok(serde_yaml::Value::String(content));
    }
    
    // For .yaml files, parse as YAML
    serde_yaml::from_str(&content)
        .map_err(|e| AppError::Serialization(format!(
            "Failed to parse {}: {}", path.display(), e
        )))
}
