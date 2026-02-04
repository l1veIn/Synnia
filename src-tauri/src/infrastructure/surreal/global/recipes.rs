use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use crate::core::AppError;
use crate::global::database::{DEFAULT_USER_RECIPES_DIR, SETTING_USER_RECIPES_DIR, expand_path};
use crate::infrastructure::hash;
use crate::infrastructure::surreal::global::{map_db_error, Db};
use crate::infrastructure::surreal::global::settings as settings_repo;

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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RecipeRecord {
    recipe_id: String,
    source: String,
    path: String,
    name: String,
    description: Option<String>,
    category: Option<String>,
    icon: Option<String>,
    author: Option<String>,
    version: i32,
    cover: Option<String>,
    tags: Vec<String>,
    content_hash: String,
    indexed_at: i64,
    updated_at: i64,
}

impl RecipeRecord {
    fn to_meta(self) -> RecipeMeta {
        RecipeMeta {
            id: self.recipe_id,
            source: RecipeSource::from_str(&self.source),
            path: self.path,
            name: self.name,
            description: self.description,
            category: self.category,
            icon: self.icon,
            author: self.author,
            version: self.version,
            cover: self.cover,
            tags: self.tags,
        }
    }
}

#[derive(Debug, Default)]
pub struct RecipeFilter {
    pub source: Option<RecipeSource>,
    pub category: Option<String>,
    pub tags: Option<Vec<String>>,
    pub limit: Option<i32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub added: i32,
    pub updated: i32,
    pub removed: i32,
}

pub async fn scan_all_recipes(db: &Db) -> Result<ScanResult, AppError> {
    let user_result = scan_user_recipes(db).await?;
    let builtin_result = scan_builtin_recipes(db).await?;

    Ok(ScanResult {
        added: user_result.added + builtin_result.added,
        updated: user_result.updated + builtin_result.updated,
        removed: user_result.removed + builtin_result.removed,
    })
}

pub async fn search_recipes(db: &Db, query: &str, limit: Option<i32>) -> Result<Vec<RecipeMeta>, AppError> {
    let all = list_recipes(db, RecipeFilter::default()).await?;
    let needle = query.to_lowercase();
    let mut results: Vec<RecipeMeta> = all
        .into_iter()
        .filter(|recipe| {
            recipe.name.to_lowercase().contains(&needle)
                || recipe.description.as_ref().map(|d| d.to_lowercase().contains(&needle)).unwrap_or(false)
                || recipe.category.as_ref().map(|c| c.to_lowercase().contains(&needle)).unwrap_or(false)
                || recipe.author.as_ref().map(|a| a.to_lowercase().contains(&needle)).unwrap_or(false)
        })
        .collect();

    if let Some(limit) = limit {
        results.truncate(limit as usize);
    }

    Ok(results)
}

pub async fn list_recipes(db: &Db, filter: RecipeFilter) -> Result<Vec<RecipeMeta>, AppError> {
    let mut response = db
        .query("SELECT * FROM recipe_index")
        .await
        .map_err(map_db_error)?;

    let records: Vec<RecipeRecord> = response.take(0).map_err(map_db_error)?;
    let mut recipes: Vec<RecipeMeta> = records.into_iter().map(|r| r.to_meta()).collect();

    if let Some(source) = filter.source {
        recipes.retain(|r| r.source == source);
    }

    if let Some(category) = filter.category {
        recipes.retain(|r| r.category.as_deref() == Some(category.as_str()));
    }

    if let Some(tags) = filter.tags {
        recipes.retain(|r| tags.iter().all(|t| r.tags.contains(t)));
    }

    recipes.sort_by(|a, b| a.name.cmp(&b.name));

    if let Some(limit) = filter.limit {
        recipes.truncate(limit as usize);
    }

    Ok(recipes)
}

pub async fn get_recipe_by_id(db: &Db, id: &str) -> Result<Option<RecipeMeta>, AppError> {
    let mut response = db
        .query("SELECT * FROM recipe_index WHERE recipeId = $id")
        .bind(("id", id.to_string()))
        .await
        .map_err(map_db_error)?;

    let record: Option<RecipeRecord> = response.take(0).map_err(map_db_error)?;
    Ok(record.map(|r| r.to_meta()))
}

pub async fn get_all_categories(db: &Db) -> Result<Vec<String>, AppError> {
    let recipes = list_recipes(db, RecipeFilter::default()).await?;
    let mut categories: Vec<String> = recipes
        .into_iter()
        .filter_map(|r| r.category)
        .collect();
    categories.sort();
    categories.dedup();
    Ok(categories)
}

pub async fn get_all_tags(db: &Db) -> Result<Vec<String>, AppError> {
    let recipes = list_recipes(db, RecipeFilter::default()).await?;
    let mut tags: Vec<String> = recipes.into_iter().flat_map(|r| r.tags).collect();
    tags.sort();
    tags.dedup();
    Ok(tags)
}

pub async fn clear_recipe_index(db: &Db) -> Result<u32, AppError> {
    let mut response = db
        .query("DELETE FROM recipe_index")
        .await
        .map_err(map_db_error)?;

    let deleted: Vec<RecipeRecord> = response.take(0).map_err(map_db_error)?;
    Ok(deleted.len() as u32)
}

pub async fn get_recipe_count(db: &Db) -> Result<u32, AppError> {
    let mut response = db
        .query("SELECT count() AS count FROM recipe_index")
        .await
        .map_err(map_db_error)?;

    #[derive(Deserialize)]
    struct CountRow { count: i64 }

    let rows: Vec<CountRow> = response.take(0).map_err(map_db_error)?;
    Ok(rows.first().map(|r| r.count).unwrap_or(0) as u32)
}

pub fn resolve_recipe_path(source: &RecipeSource, relative_path: &str, user_recipes_dir: &Path) -> PathBuf {
    match source {
        RecipeSource::User => user_recipes_dir.join(relative_path),
        RecipeSource::Marketplace => dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".synnia/marketplace")
            .join(relative_path),
        RecipeSource::Builtin => get_builtin_recipes_dir().join(relative_path),
    }
}

pub async fn get_user_recipes_dir(db: &Db) -> PathBuf {
    if let Ok(Some(path)) = settings_repo::get_setting(db, SETTING_USER_RECIPES_DIR).await {
        return expand_path(&path);
    }

    expand_path(DEFAULT_USER_RECIPES_DIR)
}

pub fn get_builtin_recipes_dir() -> PathBuf {
    let dev_path = PathBuf::from("src/features/recipes/packages");
    if dev_path.exists() {
        return dev_path;
    }

    let alt_dev_path = PathBuf::from("../src/features/recipes/packages");
    if alt_dev_path.exists() {
        return alt_dev_path;
    }

    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".synnia/builtin")
}

async fn scan_user_recipes(db: &Db) -> Result<ScanResult, AppError> {
    let recipes_dir = get_user_recipes_dir(db).await;

    if !recipes_dir.exists() {
        return Ok(ScanResult { added: 0, updated: 0, removed: 0 });
    }

    let mut added = 0;
    let mut updated = 0;
    let mut found_paths: Vec<String> = Vec::new();

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

                match index_recipe(db, RecipeSource::User, &relative_path, &manifest_path).await {
                    Ok(IndexResult::Added) => added += 1,
                    Ok(IndexResult::Updated) => updated += 1,
                    Ok(IndexResult::Unchanged) => {}
                    Err(e) => log::warn!("Failed to index recipe {}: {}", relative_path, e),
                }
            }
        }
    }

    let removed = remove_missing_recipes(db, RecipeSource::User, &found_paths).await?;

    Ok(ScanResult { added, updated, removed })
}

async fn scan_builtin_recipes(db: &Db) -> Result<ScanResult, AppError> {
    let recipes_dir = get_builtin_recipes_dir();
    log::info!("Scanning builtin recipes at: {:?}", recipes_dir);

    if !recipes_dir.exists() {
        log::warn!("Builtin recipes directory not found: {:?}", recipes_dir);
        return Ok(ScanResult { added: 0, updated: 0, removed: 0 });
    }

    let mut added = 0;
    let mut updated = 0;
    let mut found_paths: Vec<String> = Vec::new();

    scan_recipes_recursive(db, &recipes_dir, &recipes_dir, RecipeSource::Builtin, &mut added, &mut updated, &mut found_paths).await?;

    let removed = remove_missing_recipes(db, RecipeSource::Builtin, &found_paths).await?;

    log::info!("Builtin scan complete: added={}, updated={}, removed={}", added, updated, removed);
    Ok(ScanResult { added, updated, removed })
}

async fn scan_recipes_recursive(
    db: &Db,
    base_dir: &Path,
    current_dir: &Path,
    source: RecipeSource,
    added: &mut i32,
    updated: &mut i32,
    found_paths: &mut Vec<String>,
) -> Result<(), AppError> {
    let mut stack: Vec<PathBuf> = vec![current_dir.to_path_buf()];

    while let Some(dir) = stack.pop() {
        for entry in fs::read_dir(&dir)
            .map_err(|e| AppError::Io(format!("Failed to read dir {:?}: {}", dir, e)))?
        {
            let entry = entry.map_err(|e| AppError::Io(e.to_string()))?;
            let path = entry.path();

            if path.is_dir() {
                let manifest_path = path.join("manifest.yaml");
                if manifest_path.exists() {
                    let relative_path = path.strip_prefix(base_dir)
                        .map(|p| p.to_string_lossy().to_string())
                        .unwrap_or_else(|_| path.file_name().unwrap_or_default().to_string_lossy().to_string());

                    found_paths.push(relative_path.clone());

                    match index_recipe(db, source.clone(), &relative_path, &manifest_path).await {
                        Ok(IndexResult::Added) => *added += 1,
                        Ok(IndexResult::Updated) => *updated += 1,
                        Ok(IndexResult::Unchanged) => {}
                        Err(e) => log::warn!("Failed to index recipe {}: {}", relative_path, e),
                    }
                } else {
                    stack.push(path);
                }
            }
        }
    }

    Ok(())
}

enum IndexResult {
    Added,
    Updated,
    Unchanged,
}

async fn index_recipe(
    db: &Db,
    source: RecipeSource,
    relative_path: &str,
    manifest_path: &Path,
) -> Result<IndexResult, AppError> {
    let manifest_content = fs::read_to_string(manifest_path)
        .map_err(|e| AppError::Io(format!("Failed to read manifest: {}", e)))?;

    let manifest: serde_yaml::Value = serde_yaml::from_str(&manifest_content)
        .map_err(|e| AppError::Serialization(format!("Failed to parse manifest: {}", e)))?;

    let content_hash = hash::compute_content_hash(&manifest_content);

    let existing = get_recipe_by_source_path(db, source.as_str(), relative_path).await?;
    if let Some(existing) = &existing {
        if existing.content_hash == content_hash {
            return Ok(IndexResult::Unchanged);
        }
    }

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

    let record = RecipeRecord {
        recipe_id: id.clone(),
        source: source.as_str().to_string(),
        path: relative_path.to_string(),
        name,
        description,
        category,
        icon,
        author,
        version,
        cover,
        tags,
        content_hash,
        indexed_at: existing.as_ref().map(|r| r.indexed_at).unwrap_or(now),
        updated_at: now,
    };

    let record_key = recipe_record_key(source.as_str(), relative_path);
    let _: Option<RecipeRecord> = db
        .update(("recipe_index", record_key.as_str()))
        .content(record)
        .await
        .map_err(map_db_error)?;

    if existing.is_some() {
        Ok(IndexResult::Updated)
    } else {
        Ok(IndexResult::Added)
    }
}

async fn get_recipe_by_source_path(db: &Db, source: &str, path: &str) -> Result<Option<RecipeRecord>, AppError> {
    let mut response = db
        .query("SELECT * FROM recipe_index WHERE source = $source AND path = $path")
        .bind(("source", source.to_string()))
        .bind(("path", path.to_string()))
        .await
        .map_err(map_db_error)?;

    let record: Option<RecipeRecord> = response.take(0).map_err(map_db_error)?;
    Ok(record)
}

fn recipe_record_key(source: &str, path: &str) -> String {
    format!("{}:{}", source, path)
}

async fn remove_missing_recipes(db: &Db, source: RecipeSource, found_paths: &[String]) -> Result<i32, AppError> {
    let mut response = db
        .query("SELECT * FROM recipe_index WHERE source = $source")
        .bind(("source", source.as_str().to_string()))
        .await
        .map_err(map_db_error)?;

    let records: Vec<RecipeRecord> = response.take(0).map_err(map_db_error)?;
    let found: HashSet<String> = found_paths.iter().cloned().collect();
    let mut removed = 0;

    for record in records {
        if !found.contains(&record.path) {
            let _: Vec<RecipeRecord> = db
                .query("DELETE FROM recipe_index WHERE id = $id")
                .bind(("id", recipe_record_key(source.as_str(), &record.path)))
                .await
                .map_err(map_db_error)?
                .take(0)
                .map_err(map_db_error)?;
            removed += 1;
        }
    }

    Ok(removed)
}

pub async fn get_recipe_manifest_by_id(db: &Db, id: &str) -> Result<serde_json::Value, AppError> {
    let recipe = get_recipe_by_id(db, id).await?
        .ok_or_else(|| AppError::NotFound(format!("Recipe not found: {}", id)))?;

    get_recipe_manifest(&recipe.source, &recipe.path, db).await
}

pub async fn get_recipe_manifest(
    source: &RecipeSource,
    relative_path: &str,
    db: &Db,
) -> Result<serde_json::Value, AppError> {
    let user_dir = get_user_recipes_dir(db).await;
    let recipe_dir = resolve_recipe_path(source, relative_path, &user_dir);
    let manifest_path = recipe_dir.join("manifest.yaml");

    if !manifest_path.exists() {
        return Err(AppError::NotFound(format!(
            "Manifest not found: {}",
            manifest_path.display()
        )));
    }

    let manifest_content = fs::read_to_string(&manifest_path)
        .map_err(|e| AppError::Io(format!("Failed to read manifest: {}", e)))?;

    let mut manifest: serde_yaml::Value = serde_yaml::from_str(&manifest_content)
        .map_err(|e| AppError::Serialization(format!("Failed to parse manifest: {}", e)))?;

    let mut visited = HashSet::new();
    resolve_refs(&mut manifest, &recipe_dir, &mut visited, db)?;

    let json = serde_json::to_value(&manifest)
        .map_err(|e| AppError::Serialization(format!("Failed to convert to JSON: {}", e)))?;

    Ok(json)
}

fn resolve_refs(
    value: &mut serde_yaml::Value,
    base_dir: &Path,
    visited: &mut HashSet<PathBuf>,
    db: &Db,
) -> Result<(), AppError> {
    match value {
        serde_yaml::Value::Mapping(map) => {
            if let Some(serde_yaml::Value::String(ref_path)) = map.get(&serde_yaml::Value::String("$ref".to_string())) {
                let resolved_path = resolve_ref_path(base_dir, ref_path, db)?;

                if visited.contains(&resolved_path) {
                    return Err(AppError::Validation(format!(
                        "Circular reference detected: {}",
                        resolved_path.display()
                    )));
                }

                let content = load_ref_file(&resolved_path)?;
                visited.insert(resolved_path.clone());

                let ref_dir = resolved_path.parent().unwrap_or(base_dir);
                *value = content;
                resolve_refs(value, ref_dir, visited, db)?;
            } else {
                for (_, v) in map.iter_mut() {
                    resolve_refs(v, base_dir, visited, db)?;
                }
            }
        }
        serde_yaml::Value::Sequence(seq) => {
            for item in seq.iter_mut() {
                resolve_refs(item, base_dir, visited, db)?;
            }
        }
        _ => {}
    }

    Ok(())
}

fn resolve_ref_path(base_dir: &Path, ref_path: &str, db: &Db) -> Result<PathBuf, AppError> {
    if ref_path.starts_with('@') {
        return resolve_package_ref(ref_path, db);
    }

    if ref_path.starts_with('/') {
        return Ok(PathBuf::from(ref_path));
    }

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

fn resolve_package_ref(ref_path: &str, db: &Db) -> Result<PathBuf, AppError> {
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

    let record: Option<RecipeRecord> = tauri::async_runtime::block_on(async {
        let mut response = db
            .query("SELECT * FROM recipe_index WHERE recipeId = $id")
            .bind(("id", recipe_id.to_string()))
            .await
            .map_err(map_db_error)?;
        response.take(0).map_err(map_db_error)
    })?;
    let record = record.ok_or_else(|| AppError::NotFound(format!(
        "Recipe '{}' not found in index (package reference: {})",
        recipe_id, ref_path
    )))?;

    let source = RecipeSource::from_str(&record.source);
    let user_dir = tauri::async_runtime::block_on(async { get_user_recipes_dir(db).await });
    let recipe_dir = resolve_recipe_path(&source, &record.path, &user_dir);
    let full_path = recipe_dir.join(relative_path);

    Ok(full_path)
}

fn load_ref_file(path: &Path) -> Result<serde_yaml::Value, AppError> {
    if !path.exists() {
        return Err(AppError::NotFound(format!(
            "Referenced file not found: {}",
            path.display()
        )));
    }

    let content = fs::read_to_string(path)
        .map_err(|e| AppError::Io(format!("Failed to read {}: {}", path.display(), e)))?;

    if path.extension().map_or(false, |ext| ext == "md") {
        return Ok(serde_yaml::Value::String(content));
    }

    serde_yaml::from_str(&content)
        .map_err(|e| AppError::Serialization(format!(
            "Failed to parse {}: {}",
            path.display(),
            e
        )))
}
