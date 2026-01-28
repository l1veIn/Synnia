//! Bot Feature - AI Assistant for Canvas Interaction
//!
//! Provides Tauri commands for the AI Bot feature:
//! - `bot_chat`: Stream chat responses using Vercel AI SDK compatible format
//!
//! This is a minimal implementation for Phase 4 - Runtime Configuration.
//! Full toolkit implementation comes in Phase 5.

pub mod commands;

pub use commands::*;
