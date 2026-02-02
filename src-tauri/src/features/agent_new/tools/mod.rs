//! Agent tools module.
//!
//! Each tool is in its own file for better organization.

mod common;
mod create_node_smart;
mod delete_nodes;
mod get_assets_list;
mod get_nodes_list;
mod registry;
mod update_assets;
mod update_nodes;

// Re-export common types
pub use common::{AssetsToolError, NodePosition, NodesToolError};

// Re-export all tools
pub use create_node_smart::{CreateNodeResult, CreateNodeSmartArgs, CreateNodeSmartTool};
pub use delete_nodes::{DeleteNodeInfo, DeleteNodesArgs, DeleteNodesResult, DeleteNodesTool};
pub use get_assets_list::{AssetInfo, GetAssetsListArgs, GetAssetsListTool};
pub use get_nodes_list::{GetNodesListArgs, GetNodesListTool, NodeInfo};
pub use update_assets::{
    AssetUpdate, SingleAssetUpdateResult, UpdateAssetsArgs, UpdateAssetsResult, UpdateAssetsTool,
};
pub use update_nodes::{
    NodeUpdate, SingleUpdateResult, UpdateNodesArgs, UpdateNodesResult, UpdateNodesTool,
};

// Re-export registry
pub use registry::{AgentTool, ToolRegistry};
