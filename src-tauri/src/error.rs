use serde::Serialize;
use std::fmt;

#[derive(Debug, Serialize)]
#[serde(tag = "code", content = "message")]
pub enum AppError {
    Database(String),
    Io(String),
    Network(String),
    Agent(String),
    ProjectNotLoaded,
    NotFound(String),
    Unknown(String),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:?}", self)
    }
}

impl std::error::Error for AppError {}

// Automatic conversion from SQL errors
impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        AppError::Database(err.to_string())
    }
}

// Automatic conversion from IO errors
impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::Io(err.to_string())
    }
}

// Automatic conversion from Serde JSON errors
impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::Unknown(format!("Serialization error: {}", err))
    }
}

// Allow converting AppError to String for Tauri's Command Result (temporary compat)
// Ideally we return AppError directly, but Tauri requires the Error type to be Serialize.
// Since we derived Serialize, it works!
