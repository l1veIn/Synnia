//! Storage layer for agent sessions and messages.
//!
//! This module provides database persistence for AI agent conversations,
//! including sessions, messages, and tool call tracking.

pub mod repository;

// Re-export commonly used functions
pub use repository::{
    // Schema
    init_schema,
    // Session operations
    create_session,
    get_sessions,
    get_session,
    update_session_title,
    update_session_model,
    delete_session,
    session_exists,
    // Message operations
    save_message,
    save_messages,
    get_messages,
    get_message,
    delete_message,
    clear_session_messages,
    count_messages,
};

/// Database schema SQL for agent storage.
///
/// This contains the CREATE TABLE statements for agent_sessions
/// and agent_messages tables, along with their indexes.
pub const SCHEMA_SQL: &str = include_str!("schema.sql");
