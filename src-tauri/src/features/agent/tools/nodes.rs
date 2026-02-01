//! Node query tool for agent.
//!
//! This module provides a tool that allows the AI agent to query
//! nodes in the current project.
//!
//! ## Example
//!
//! ```no_run
//! use crate::features::agent::tools::nodes::GetNodesListTool;
//!
//! let tool = GetNodesListTool::new("/path/to/project");
//! // The tool can be registered with an Agent
//! ```

use rig_core::completion::ToolDefinition;
use rig_core::tool::Tool;
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::features::agent::types::AgentResult;

/// Arguments for the get_nodes_list tool.
#[derive(Debug, Deserialize, Serialize)]
pub struct GetNodesListArgs {
    /// Optional filter for node type
    #[serde(skip_serializing_if = "Option::is_none")]
    pub node_type: Option<String>,
}

/// Information about a single node.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeInfo {
    /// Unique identifier for the node
    pub id: String,
    /// Node type (e.g., "image", "text", "code")
    pub node_type: String,
    /// Node title or name
    pub title: String,
    /// File path if applicable
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
}

/// Tool for getting the list of nodes in the current project.
///
/// This tool reads nodes from the project database and returns
/// information about each node.
#[derive(Clone)]
pub struct GetNodesListTool {
    /// Path to the project directory
    project_path: String,
}

impl GetNodesListTool {
    /// Create a new GetNodesListTool.
    ///
    /// # Arguments
    ///
    /// * `project_path` - Path to the project directory
    pub fn new(project_path: impl Into<String>) -> Self {
        Self {
            project_path: project_path.into(),
        }
    }

    /// Get the project path.
    pub fn project_path(&self) -> &str {
        &self.project_path
    }

    /// Execute the tool and return node information.
    pub fn execute(&self, _args: &GetNodesListArgs) -> AgentResult<Vec<NodeInfo>> {
        // For Phase 6, we return a mock implementation
        // In future phases, this will query the actual project database

        // Check if project path exists
        let path = std::path::Path::new(&self.project_path);
        if !path.exists() {
            return Err(crate::features::agent::types::AgentError::ToolError(format!(
                "Project path does not exist: {}",
                self.project_path
            )));
        }

        // Mock implementation - return empty list for now
        // In the future, this will query:
        // SELECT id, type, title, file_path FROM nodes WHERE type = ?1
        Ok(vec![])
    }
}

// Custom error type for the tool
#[derive(Debug, thiserror::Error)]
#[error("Nodes tool error: {0}")]
pub struct NodesToolError(String);

impl Tool for GetNodesListTool {
    const NAME: &'static str = "get_nodes_list";

    type Error = NodesToolError;
    type Args = GetNodesListArgs;
    type Output = Vec<NodeInfo>;

    async fn definition(&self, _prompt: String) -> ToolDefinition {
        ToolDefinition {
            name: "get_nodes_list".to_string(),
            description: "Get a list of nodes in the current project. Nodes represent elements like images, text blocks, or code snippets in the user's workspace.".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "node_type": {
                        "type": "string",
                        "description": "Optional filter to only get nodes of a specific type (e.g., 'image', 'text', 'code')",
                    }
                },
            }),
        }
    }

    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        self.execute(&args)
            .map_err(|e| NodesToolError(e.to_string()))
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_nodes_list_tool_new() {
        let tool = GetNodesListTool::new("/path/to/project");
        assert_eq!(tool.project_path(), "/path/to/project");
    }

    #[test]
    fn test_get_nodes_list_args_empty() {
        let args = GetNodesListArgs { node_type: None };
        assert!(args.node_type.is_none());
    }

    #[test]
    fn test_get_nodes_list_args_with_type() {
        let args = GetNodesListArgs {
            node_type: Some("image".to_string()),
        };
        assert_eq!(args.node_type, Some("image".to_string()));
    }

    #[test]
    fn test_node_info_serialization() {
        let node = NodeInfo {
            id: "123".to_string(),
            node_type: "image".to_string(),
            title: "My Photo".to_string(),
            file_path: Some("/path/to/photo.jpg".to_string()),
        };

        let json = serde_json::to_string(&node).unwrap();
        assert!(json.contains("\"id\":\"123\""));
        assert!(json.contains("\"node_type\":\"image\""));
    }

    #[tokio::test]
    async fn test_tool_definition() {
        let tool = GetNodesListTool::new("/test/path");
        let def = tool.definition(String::new()).await;

        assert_eq!(def.name, "get_nodes_list");
        assert!(!def.description.is_empty());
        assert!(def.parameters.is_object());
    }

    #[tokio::test]
    async fn test_tool_call_nonexistent_path() {
        let tool = GetNodesListTool::new("/nonexistent/path/that/does/not/exist");
        let args = GetNodesListArgs { node_type: None };

        let result = tool.call(args).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_tool_call_empty_args() {
        // Create a temporary directory to test with
        let temp_dir = tempfile::tempdir().unwrap();
        let tool = GetNodesListTool::new(temp_dir.path().to_str().unwrap());
        let args = GetNodesListArgs { node_type: None };

        let result = tool.call(args).await;
        // Should succeed with empty list (mock implementation)
        assert!(result.is_ok());
        assert!(result.unwrap().is_empty());
    }
}
