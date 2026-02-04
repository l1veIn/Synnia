use std::path::PathBuf;

use surrealdb::engine::local::{Db, SurrealKv};
use surrealdb::Surreal;
use tauri::{AppHandle, Manager};

use crate::core::AppError;

pub mod repositories;
pub mod global;

pub type SurrealDb = Surreal<Db>;

const DEFAULT_NS: &str = "synnia";
const GLOBAL_DB: &str = "global";

pub async fn init_surreal_global_db(app: &AppHandle) -> Result<SurrealDb, AppError> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Io(e.to_string()))?;
    ensure_dir(&app_data_dir)?;

    let db_path = app_data_dir.join("surrealdb");
    ensure_dir(&db_path)?;

    let endpoint = format!("kv://{}", db_path.to_string_lossy());
    let db = Surreal::new::<SurrealKv>(&endpoint)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    db.use_ns(DEFAULT_NS)
        .use_db(GLOBAL_DB)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(db)
}

pub async fn init_surreal_project_db(app: &AppHandle, project_id: &str) -> Result<SurrealDb, AppError> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Io(e.to_string()))?;
    ensure_dir(&app_data_dir)?;

    let db_path = app_data_dir.join("surrealdb");
    ensure_dir(&db_path)?;

    let endpoint = format!("kv://{}", db_path.to_string_lossy());
    let db = Surreal::new::<SurrealKv>(&endpoint)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    let db_name = format!("project_{}", project_id);
    db.use_ns(DEFAULT_NS)
        .use_db(db_name)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(db)
}

fn ensure_dir(path: &PathBuf) -> Result<(), AppError> {
    if !path.exists() {
        std::fs::create_dir_all(path)?;
    }
    Ok(())
}
