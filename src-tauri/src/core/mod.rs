//! Core infrastructure module.
//!
//! Contains fundamental types and utilities used across the application:
//! - Error types and Result alias
//! - Application state

pub mod error;
pub mod state;

pub use error::{AppError, Result};
pub use state::AppState;
