//! Global data module.
//!
//! Manages application-wide data stored in `~/.synnia/synnia.db`:
//! - Application settings (KV + JSON)
//! - Project registry
//! - Recipe index with FTS5 search

pub mod database;
pub mod settings;
pub mod projects;
pub mod recipes;
