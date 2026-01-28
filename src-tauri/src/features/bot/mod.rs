//! Bot Feature - AI Assistant for Canvas Interaction
//!
//! Provides Tauri commands for the AI Bot feature:
//! - `bot_chat`: Stream chat responses using Vercel AI SDK compatible format
//! - `save_bot_history`: Save chat history to disk
//! - `load_bot_history`: Load chat history from disk
//! - `list_bot_sessions`: List all chat sessions
//! - `delete_bot_session`: Delete a chat session
//!
//! Phase 6: Added persistence for chat history.

pub mod commands;
pub mod persistence;

pub use commands::*;
pub use persistence::*;
