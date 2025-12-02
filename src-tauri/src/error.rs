use serde::Serialize;
use std::fmt;

#[derive(Debug, Serialize)]
#[serde(tag = "code", content = "message")]
pub enum AppError {
    Io(String),
    Network(String),
    Agent(String),
    ProjectNotLoaded,
    NotFound(String),
    Unknown(String),
    Serialization(String),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:?}", self)
    }
}

impl std::error::Error for AppError {}

// Automatic conversion from IO errors
impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::Io(err.to_string())
    }
}

// Automatic conversion from Serde JSON errors
impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::Serialization(err.to_string())
    }
}