//! Tool definitions for agent function calling.
//!
//! This module provides tools that can be used by AI agents
//! to interact with the application and user's projects.

pub mod registry;
pub mod nodes;
pub mod assets;

// Re-export common types
pub use nodes::{GetNodesListTool, NodeInfo, NodesToolError};
pub use assets::{GetAssetsListTool, AssetInfo, AssetsToolError};
