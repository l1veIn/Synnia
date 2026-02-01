//! Asset query tool for agent.
//!
//! This module provides a tool that allows the AI agent to query
//! assets in the current project.

use rig_core::completion::ToolDefinition;
use rig_core::tool::Tool;
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::features::agent::types::AgentResult;

/// Arguments for the get_assets_list tool.
#[derive(Debug, Deserialize, Serialize)]
pub struct GetAssetsListArgs {
    /// Optional filter for asset type
    #[serde(skip_serializing_if = "Option::is_none")]
    pub asset_type: Option<String>,
}

/// Information about a single asset.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetInfo {
    /// Unique identifier for the asset
    pub id: String,
    /// Asset type (e.g., "image", "video", "audio")
    pub asset_type: String,
    /// Asset file name
    pub filename: String,
    /// File path
    pub file_path: String,
    /// File size in bytes
    pub size_bytes: u64,
}

/// Tool for getting the list of assets in the current project.
///
/// This tool reads assets from the project database and returns
/// information about each asset.
#[derive(Clone)]
pub struct GetAssetsListTool {
    /// Path to the project directory
    project_path: String,
}

impl GetAssetsListTool {
    /// Create a new GetAssetsListTool.
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

    /// Execute the tool and return asset information.
    pub fn execute(&self, _args: &GetAssetsListArgs) -> AgentResult<Vec<AssetInfo>> {
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
        // SELECT id, type, filename, file_path, size_bytes FROM assets WHERE type = ?1
        Ok(vec![])
    }
}

// Custom error type for the tool
#[derive(Debug, thiserror::Error)]
#[error("Assets tool error: {0}")]
pub struct AssetsToolError(String);

impl Tool for GetAssetsListTool {
    const NAME: &'static str = "get_assets_list";

    type Error = AssetsToolError;
    type Args = GetAssetsListArgs;
    type Output = Vec<AssetInfo>;

    async fn definition(&self, _prompt: String) -> ToolDefinition {
        ToolDefinition {
            name: "get_assets_list".to_string(),
            description: "Get a list of assets in the current project. Assets include images, videos, audio files, and other media stored in the user's workspace.".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "asset_type": {
                        "type": "string",
                        "description": "Optional filter to only get assets of a specific type (e.g., 'image', 'video', 'audio')",
                    }
                },
            }),
        }
    }

    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        self.execute(&args)
            .map_err(|e| AssetsToolError(e.to_string()))
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_assets_list_tool_new() {
        let tool = GetAssetsListTool::new("/path/to/project");
        assert_eq!(tool.project_path(), "/path/to/project");
    }

    #[test]
    fn test_get_assets_list_args_empty() {
        let args = GetAssetsListArgs { asset_type: None };
        assert!(args.asset_type.is_none());
    }

    #[test]
    fn test_get_assets_list_args_with_type() {
        let args = GetAssetsListArgs {
            asset_type: Some("image".to_string()),
        };
        assert_eq!(args.asset_type, Some("image".to_string()));
    }

    #[test]
    fn test_asset_info_serialization() {
        let asset = AssetInfo {
            id: "123".to_string(),
            asset_type: "image".to_string(),
            filename: "photo.jpg".to_string(),
            file_path: "/path/to/photo.jpg".to_string(),
            size_bytes: 1024,
        };

        let json = serde_json::to_string(&asset).unwrap();
        assert!(json.contains("\"id\":\"123\""));
        assert!(json.contains("\"asset_type\":\"image\""));
    }

    #[tokio::test]
    async fn test_tool_definition() {
        let tool = GetAssetsListTool::new("/test/path");
        let def = tool.definition(String::new()).await;

        assert_eq!(def.name, "get_assets_list");
        assert!(!def.description.is_empty());
        assert!(def.parameters.is_object());
    }

    #[tokio::test]
    async fn test_tool_call_nonexistent_path() {
        let tool = GetAssetsListTool::new("/nonexistent/path/that/does/not/exist");
        let args = GetAssetsListArgs { asset_type: None };

        let result = tool.call(args).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_tool_call_empty_args() {
        // Create a temporary directory to test with
        let temp_dir = tempfile::tempdir().unwrap();
        let tool = GetAssetsListTool::new(temp_dir.path().to_str().unwrap());
        let args = GetAssetsListArgs { asset_type: None };

        let result = tool.call(args).await;
        // Should succeed with empty list (mock implementation)
        assert!(result.is_ok());
        assert!(result.unwrap().is_empty());
    }
}
