//! Feature modules.
//!
//! Contains all business logic organized by domain:
//! - project: Project lifecycle management
//! - asset: Asset CRUD and media processing
//! - history: Version history for assets
//! - recipe: Recipe management
//! - settings: Application settings
//! - agent: AI agent functionality
//! - operations: Runtime operations (chat, logs)
//!
//! NOTE: During migration, these modules coexist with old code in commands/ and services/.
//! Once migration is complete:
//! 1. Enable the "new_features" feature in Cargo.toml
//! 2. Update lib.rs to use these modules
//! 3. Remove old commands/ and services/ directories

// Feature-gated new modules to avoid command name conflicts during migration
#[cfg(feature = "new_features")]
pub mod project;
#[cfg(feature = "new_features")]
pub mod asset;
#[cfg(feature = "new_features")]
pub mod history;
#[cfg(feature = "new_features")]
pub mod recipe;
#[cfg(feature = "new_features")]
pub mod settings;
#[cfg(feature = "new_features")]
pub mod agent;
#[cfg(feature = "new_features")]
pub mod operations;

// Stub modules when new_features is disabled (during migration)
#[cfg(not(feature = "new_features"))]
pub mod project {
    pub mod commands {}
    pub mod persistence {}
}
#[cfg(not(feature = "new_features"))]
pub mod asset {
    pub mod commands {}
    pub mod persistence {}
    pub mod types {}
    pub mod image {}
}
#[cfg(not(feature = "new_features"))]
pub mod history {
    pub mod commands {}
    pub mod persistence {}
}
#[cfg(not(feature = "new_features"))]
pub mod recipe {
    pub mod commands {}
    pub mod persistence {}
    pub mod types {}
}
#[cfg(not(feature = "new_features"))]
pub mod settings {
    pub mod commands {}
    pub mod config {}
}
#[cfg(not(feature = "new_features"))]
pub mod agent {
    pub mod commands {}
    pub mod service {}
}
#[cfg(not(feature = "new_features"))]
pub mod operations {
    pub mod chat {}
    pub mod logs {}
}
