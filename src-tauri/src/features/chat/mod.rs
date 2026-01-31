//! Chat persistence module.
//!
//! Provides JSON file-based persistence for chat threads:
//! - Index file: `{projectDir}/chat/index.json`
//! - Thread files: `{projectDir}/chat/threads/{threadId}.json`

pub mod commands;
pub mod types;

pub use commands::*;
pub use types::*;
