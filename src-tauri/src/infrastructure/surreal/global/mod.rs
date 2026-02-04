use crate::core::AppError;
use crate::infrastructure::surreal::SurrealDb;

pub mod projects;
pub mod settings;
pub mod recipes;

pub fn map_db_error<E: std::fmt::Display>(err: E) -> AppError {
    AppError::Database(err.to_string())
}

pub type Db = SurrealDb;
