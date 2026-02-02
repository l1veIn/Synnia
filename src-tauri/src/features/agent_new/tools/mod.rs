//! Tool definitions for agent_new module.
//!
//! This module provides tools that can be used by AI agents
//! to interact with the application and user's projects.

pub mod get_nodes;

// Re-export common types
pub use get_nodes::{GetNodesListTool, NodeInfo, NodesToolError, GetNodesListArgs};
