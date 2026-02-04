//! Infrastructure layer.
//!
//! Contains low-level infrastructure components:
//! - Database connections and schema
//! - HTTP client utilities
//! - File server
//! - Hashing utilities

pub mod database;
pub mod http;
pub mod server;
pub mod hash;
pub mod surreal;
