//! GetAssetsListTool - Query assets in the project.

use super::common::{get_content_preview, is_empty_value, AssetsToolError};
use rig_core::completion::ToolDefinition;
use rig_core::tool::Tool;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::json;

/// Arguments for the get_assets_list tool.
#[derive(Debug, Deserialize, Serialize)]
pub struct GetAssetsListArgs {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub asset_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<u32>,
}

/// Information about a single asset.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetInfo {
    pub id: String,
    pub asset_type: String,
    pub has_content: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_preview: Option<String>,
}

/// Tool for getting the list of assets in the current project.
#[derive(Clone)]
pub struct GetAssetsListTool {
    project_path: String,
}

impl GetAssetsListTool {
    pub fn new(project_path: impl Into<String>) -> Self {
        Self {
            project_path: project_path.into(),
        }
    }

    pub fn project_path(&self) -> &str {
        &self.project_path
    }

    pub fn execute(&self, args: &GetAssetsListArgs) -> Result<Vec<AssetInfo>, AssetsToolError> {
        let project_path = std::path::Path::new(&self.project_path);
        let db_path = project_path.join("synnia.db");

        if !db_path.exists() {
            return Err(AssetsToolError(format!(
                "Project database not found: {}",
                db_path.display()
            )));
        }

        let conn = Connection::open(&db_path)
            .map_err(|e| AssetsToolError(format!("Failed to open database: {}", e)))?;

        self.query_assets(&conn, args)
    }

    fn query_assets(
        &self,
        conn: &Connection,
        args: &GetAssetsListArgs,
    ) -> Result<Vec<AssetInfo>, AssetsToolError> {
        let mut stmt = conn
            .prepare("SELECT id, value_type, value_json FROM assets")
            .map_err(|e| AssetsToolError(format!("Failed to prepare query: {}", e)))?;

        let assets = stmt
            .query_map([], |row| {
                let id: String = row.get(0)?;
                let asset_type: String = row.get(1)?;
                let value_json: Option<String> = row.get(2)?;

                let (has_content, content_preview) = if let Some(ref json_str) = value_json {
                    let value: serde_json::Value =
                        serde_json::from_str(json_str).unwrap_or(serde_json::Value::Null);
                    let has_content = !is_empty_value(&value);
                    let preview = get_content_preview(&value, 50);
                    (has_content, preview)
                } else {
                    (false, None)
                };

                Ok(AssetInfo {
                    id,
                    asset_type,
                    has_content,
                    content_preview,
                })
            })
            .map_err(|e| AssetsToolError(format!("Failed to query assets: {}", e)))?;

        let mut result: Vec<AssetInfo> = assets.filter_map(|r| r.ok()).collect();

        if let Some(ref asset_type) = args.asset_type {
            let type_lower = asset_type.to_lowercase();
            result.retain(|a| a.asset_type.to_lowercase().contains(&type_lower));
        }

        if let Some(limit) = args.limit {
            result.truncate(limit as usize);
        }

        Ok(result)
    }
}

impl Tool for GetAssetsListTool {
    const NAME: &'static str = "get_assets_list";

    type Error = AssetsToolError;
    type Args = GetAssetsListArgs;
    type Output = Vec<AssetInfo>;

    async fn definition(&self, _prompt: String) -> ToolDefinition {
        ToolDefinition {
            name: "get_assets_list".to_string(),
            description: "Query assets in the project database with optional filters.

Use filters to narrow down results:
- asset_type: filter by type (record, image, video, audio, etc.)
- limit: max results to return".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "asset_type": {
                        "type": "string",
                        "description": "Filter by asset type"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of results to return"
                    }
                }
            }),
        }
    }

    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        self.execute(&args)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_assets_list_tool_new() {
        let tool = GetAssetsListTool::new("/test/path");
        assert_eq!(tool.project_path(), "/test/path");
    }

    #[test]
    fn test_get_assets_list_args_empty() {
        let args: GetAssetsListArgs = serde_json::from_str("{}").unwrap();
        assert!(args.asset_type.is_none());
        assert!(args.limit.is_none());
    }

    #[test]
    fn test_tool_call_nonexistent_path() {
        let tool = GetAssetsListTool::new("/nonexistent/path");
        let args = GetAssetsListArgs {
            asset_type: None,
            limit: None,
        };
        let result = tool.execute(&args);
        assert!(result.is_err());
    }
}
