//! Chat persistence module.
//!
//! Provides SQL-based persistence for chat sessions in project database.
//! - Sessions: `chat_sessions` table
//! - Messages: `session_messages` table

pub mod commands;
pub mod session_repository;
pub mod types;

pub use commands::*;
pub use session_repository::*;
pub use types::*;
