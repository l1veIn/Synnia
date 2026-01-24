//! Application error types.
//!
//! Provides a unified error type for the entire application with automatic
//! conversions from common error types using thiserror.

use serde::Serialize;
use thiserror::Error;

/// Result type alias using AppError.
pub type Result<T> = std::result::Result<T, AppError>;

/// Application-wide error type.
#[derive(Debug, Error, Serialize)]
#[serde(tag = "code", content = "message")]
pub enum AppError {
    /// I/O operation failed
    #[error("IO error: {0}")]
    Io(String),
    
    /// Network request failed
    #[error("Network error: {0}")]
    Network(String),
    
    /// Agent/AI operation failed
    #[error("Agent error: {0}")]
    Agent(String),
    
    /// No project is currently loaded
    #[error("No project loaded")]
    ProjectNotLoaded,
    
    /// Requested resource not found
    #[error("Not found: {0}")]
    NotFound(String),
    
    /// Unknown or unclassified error
    #[error("Unknown error: {0}")]
    Unknown(String),
    
    /// Serialization/deserialization failed
    #[error("Serialization error: {0}")]
    Serialization(String),
    
    /// Database operation failed
    #[error("Database error: {0}")]
    Database(String),
    
    /// Validation error
    #[error("Validation error: {0}")]
    Validation(String),
    
    /// Configuration error
    #[error("Config error: {0}")]
    Config(String),
}

// ============================================
// Automatic conversions
// ============================================

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::Io(err.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::Serialization(err.to_string())
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        AppError::Database(err.to_string())
    }
}
