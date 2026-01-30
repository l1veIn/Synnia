//! Chat persistence module.
//!
//! Provides JSON file-based persistence for chat conversations.
//! Storage structure:
//! - ~/.synnia/chat/index.json (thread list metadata)
//! - ~/.synnia/chat/threads/{id}.json (individual thread data)

pub mod commands;
pub mod types;

pub use commands::*;
pub use types::*;
