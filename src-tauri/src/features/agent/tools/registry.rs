//! Tool registry for agent function calling.

use super::create_node_smart::CreateNodeSmartTool;
use super::delete_nodes::DeleteNodesTool;
use super::get_assets_list::GetAssetsListTool;
use super::get_nodes_list::GetNodesListTool;
use super::update_assets::UpdateAssetsTool;
use super::update_nodes::UpdateNodesTool;

/// Registry of available tools for the AI agent.
pub struct ToolRegistry;

impl ToolRegistry {
    /// Create all available tools for a given project path.
    pub fn create_tools(project_path: Option<String>) -> Vec<AgentTool> {
        let path = project_path.unwrap_or_else(|| String::from("."));

        vec![
            AgentTool::GetNodesList(GetNodesListTool::new(&path)),
            AgentTool::CreateNodeSmart(CreateNodeSmartTool::new(&path)),
            AgentTool::UpdateNodes(UpdateNodesTool::new(&path)),
            AgentTool::DeleteNodes(DeleteNodesTool::new(&path)),
            AgentTool::GetAssetsList(GetAssetsListTool::new(&path)),
            AgentTool::UpdateAssets(UpdateAssetsTool::new(&path)),
        ]
    }

    /// Create a single tool by name.
    pub fn create_tool(tool_name: &str, project_path: &str) -> Option<AgentTool> {
        match tool_name {
            "get_nodes_list" => Some(AgentTool::GetNodesList(GetNodesListTool::new(project_path))),
            "create_node_smart" => {
                Some(AgentTool::CreateNodeSmart(CreateNodeSmartTool::new(project_path)))
            }
            "update_nodes" => Some(AgentTool::UpdateNodes(UpdateNodesTool::new(project_path))),
            "delete_nodes" => Some(AgentTool::DeleteNodes(DeleteNodesTool::new(project_path))),
            "get_assets_list" => {
                Some(AgentTool::GetAssetsList(GetAssetsListTool::new(project_path)))
            }
            "update_assets" => Some(AgentTool::UpdateAssets(UpdateAssetsTool::new(project_path))),
            _ => None,
        }
    }

    /// Get all available tool names.
    pub fn available_tools() -> Vec<&'static str> {
        vec![
            "get_nodes_list",
            "create_node_smart",
            "update_nodes",
            "delete_nodes",
            "get_assets_list",
            "update_assets",
        ]
    }
}

/// Enum wrapper for all available tools.
pub enum AgentTool {
    GetNodesList(GetNodesListTool),
    CreateNodeSmart(CreateNodeSmartTool),
    UpdateNodes(UpdateNodesTool),
    DeleteNodes(DeleteNodesTool),
    GetAssetsList(GetAssetsListTool),
    UpdateAssets(UpdateAssetsTool),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tool_registry_available_tools() {
        let tools = ToolRegistry::available_tools();
        assert_eq!(tools.len(), 6);
        assert!(tools.contains(&"get_nodes_list"));
        assert!(tools.contains(&"create_node_smart"));
        assert!(tools.contains(&"update_nodes"));
        assert!(tools.contains(&"delete_nodes"));
        assert!(tools.contains(&"get_assets_list"));
        assert!(tools.contains(&"update_assets"));
    }

    #[test]
    fn test_tool_registry_create_tools() {
        let tools = ToolRegistry::create_tools(Some("/test/path".to_string()));
        assert_eq!(tools.len(), 6);
    }

    #[test]
    fn test_tool_registry_create_tool_nodes() {
        let tool = ToolRegistry::create_tool("get_nodes_list", "/test/path");
        assert!(tool.is_some());
        assert!(matches!(tool, Some(AgentTool::GetNodesList(_))));
    }

    #[test]
    fn test_tool_registry_create_tool_create_node() {
        let tool = ToolRegistry::create_tool("create_node_smart", "/test/path");
        assert!(tool.is_some());
        assert!(matches!(tool, Some(AgentTool::CreateNodeSmart(_))));
    }

    #[test]
    fn test_tool_registry_create_tool_update_nodes() {
        let tool = ToolRegistry::create_tool("update_nodes", "/test/path");
        assert!(tool.is_some());
        assert!(matches!(tool, Some(AgentTool::UpdateNodes(_))));
    }

    #[test]
    fn test_tool_registry_create_tool_delete_nodes() {
        let tool = ToolRegistry::create_tool("delete_nodes", "/test/path");
        assert!(tool.is_some());
        assert!(matches!(tool, Some(AgentTool::DeleteNodes(_))));
    }

    #[test]
    fn test_tool_registry_create_tool_assets() {
        let tool = ToolRegistry::create_tool("get_assets_list", "/test/path");
        assert!(tool.is_some());
        assert!(matches!(tool, Some(AgentTool::GetAssetsList(_))));
    }

    #[test]
    fn test_tool_registry_create_tool_update_assets() {
        let tool = ToolRegistry::create_tool("update_assets", "/test/path");
        assert!(tool.is_some());
        assert!(matches!(tool, Some(AgentTool::UpdateAssets(_))));
    }

    #[test]
    fn test_tool_registry_create_tool_unknown() {
        let tool = ToolRegistry::create_tool("unknown_tool", "/test/path");
        assert!(tool.is_none());
    }

    #[test]
    fn test_tool_registry_create_tools_default_path() {
        let tools = ToolRegistry::create_tools(None);
        assert_eq!(tools.len(), 6);
    }
}
