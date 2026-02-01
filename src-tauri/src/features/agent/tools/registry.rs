//! Tool registry for agent function calling.
//!
//! This module provides a registry for managing available tools
//! that can be used by AI agents.

use crate::features::agent::tools::assets::GetAssetsListTool;
use crate::features::agent::tools::nodes::GetNodesListTool;

/// Registry of available tools for the AI agent.
///
/// The tool registry manages all tools that can be used by agents,
/// providing factory methods to create tool instances with the
/// appropriate context (e.g., project path).
pub struct ToolRegistry;

impl ToolRegistry {
    /// Create all available tools for a given project path.
    ///
    /// # Arguments
    ///
    /// * `project_path` - Optional path to the project directory
    ///
    /// # Returns
    ///
    /// A vector of boxed tool trait objects
    pub fn create_tools(project_path: Option<String>) -> Vec<AgentTool> {
        let path = project_path.unwrap_or_else(|| String::from("."));

        vec![
            AgentTool::Nodes(GetNodesListTool::new(&path)),
            AgentTool::Assets(GetAssetsListTool::new(&path)),
        ]
    }

    /// Create a single tool by name.
    ///
    /// # Arguments
    ///
    /// * `tool_name` - Name of the tool to create
    /// * `project_path` - Path to the project directory
    ///
    /// # Returns
    ///
    /// `Some(AgentTool)` if the tool exists, `None` otherwise
    pub fn create_tool(tool_name: &str, project_path: &str) -> Option<AgentTool> {
        match tool_name {
            "get_nodes_list" => Some(AgentTool::Nodes(GetNodesListTool::new(project_path))),
            "get_assets_list" => Some(AgentTool::Assets(GetAssetsListTool::new(project_path))),
            _ => None,
        }
    }

    /// Get all available tool names.
    pub fn available_tools() -> Vec<&'static str> {
        vec!["get_nodes_list", "get_assets_list"]
    }
}

/// Enum wrapper for all available tools.
///
/// This allows storing different tool types in a homogeneous collection.
pub enum AgentTool {
    /// Get nodes list tool
    Nodes(GetNodesListTool),
    /// Get assets list tool
    Assets(GetAssetsListTool),
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tool_registry_available_tools() {
        let tools = ToolRegistry::available_tools();
        assert_eq!(tools.len(), 2);
        assert!(tools.contains(&"get_nodes_list"));
        assert!(tools.contains(&"get_assets_list"));
    }

    #[test]
    fn test_tool_registry_create_tools() {
        let tools = ToolRegistry::create_tools(Some("/test/path".to_string()));
        assert_eq!(tools.len(), 2);
    }

    #[test]
    fn test_tool_registry_create_tool_nodes() {
        let tool = ToolRegistry::create_tool("get_nodes_list", "/test/path");
        assert!(tool.is_some());
        assert!(matches!(tool, Some(AgentTool::Nodes(_))));
    }

    #[test]
    fn test_tool_registry_create_tool_assets() {
        let tool = ToolRegistry::create_tool("get_assets_list", "/test/path");
        assert!(tool.is_some());
        assert!(matches!(tool, Some(AgentTool::Assets(_))));
    }

    #[test]
    fn test_tool_registry_create_tool_unknown() {
        let tool = ToolRegistry::create_tool("unknown_tool", "/test/path");
        assert!(tool.is_none());
    }

    #[test]
    fn test_tool_registry_create_tools_default_path() {
        let tools = ToolRegistry::create_tools(None);
        assert_eq!(tools.len(), 2);
    }
}
