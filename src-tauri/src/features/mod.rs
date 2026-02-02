//! Feature modules.
//!
//! Contains all business logic organized by domain:
//! - project: Project lifecycle management
//! - asset: Asset CRUD and media processing
//! - history: Version history for assets
//! - recipe: Recipe management
//! - settings: Application settings
//! - operations: Runtime operations (chat, logs)
//! - chat: Chat persistence
//! - agent: AI Agent system (Rig.rs)
//! - agent_new: New simplified AI agent implementation

pub mod project;
pub mod asset;
pub mod history;
pub mod recipe;
pub mod settings;
pub mod operations;
pub mod chat;
pub mod agent;
pub mod agent_new;

