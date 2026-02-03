//! GetNodesListTool - Query nodes on the canvas.

use super::common::{get_content_preview, is_empty_value, NodePosition, NodesToolError};
use rig_core::completion::ToolDefinition;
use rig_core::tool::Tool;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::json;

/// Arguments for the get_nodes_list tool.
#[derive(Debug, Deserialize, Serialize)]
pub struct GetNodesListArgs {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub node_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_empty: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title_contains: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<u32>,
}

/// Information about a single node.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeInfo {
    pub id: String,
    pub node_type: String,
    pub title: String,
    pub state: String,
    pub position: NodePosition,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub asset_id: Option<String>,
    pub has_content: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_preview: Option<String>,
}

/// Tool for getting the list of nodes in the current project.
#[derive(Clone)]
pub struct GetNodesListTool {
    project_path: String,
}

impl GetNodesListTool {
    pub fn new(project_path: impl Into<String>) -> Self {
        Self {
            project_path: project_path.into(),
        }
    }

    pub fn project_path(&self) -> &str {
        &self.project_path
    }

    pub fn execute(&self, args: &GetNodesListArgs) -> Result<Vec<NodeInfo>, NodesToolError> {
        let project_path = std::path::Path::new(&self.project_path);
        let db_path = project_path.join("synnia.db");

        if !db_path.exists() {
            return Err(NodesToolError(format!(
                "Project database not found: {}",
                db_path.display()
            )));
        }

        let conn = Connection::open(&db_path)
            .map_err(|e| NodesToolError(format!("Failed to open database: {}", e)))?;

        self.query_nodes(&conn, args)
    }

    fn query_nodes(
        &self,
        conn: &Connection,
        args: &GetNodesListArgs,
    ) -> Result<Vec<NodeInfo>, NodesToolError> {
        let mut stmt = conn
            .prepare(
                "SELECT n.id, n.type, n.x, n.y, n.data_json, a.value_json
                 FROM nodes n
                 LEFT JOIN assets a ON json_extract(n.data_json, '$.assetId') = a.id",
            )
            .map_err(|e| NodesToolError(format!("Failed to prepare query: {}", e)))?;

        let nodes = stmt
            .query_map([], |row| {
                let id: String = row.get(0)?;
                let node_type: String = row.get(1)?;
                let x: f64 = row.get(2)?;
                let y: f64 = row.get(3)?;
                let data_json: String = row.get(4)?;
                let asset_value_json: Option<String> = row.get(5)?;

                let data: serde_json::Value =
                    serde_json::from_str(&data_json).unwrap_or(serde_json::Value::Null);

                let title = data
                    .get("title")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Untitled")
                    .to_string();
                let state = data
                    .get("state")
                    .and_then(|v| v.as_str())
                    .unwrap_or("idle")
                    .to_string();
                let asset_id = data
                    .get("assetId")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());

                let (has_content, content_preview) = if let Some(ref value_json) = asset_value_json
                {
                    let value: serde_json::Value =
                        serde_json::from_str(value_json).unwrap_or(serde_json::Value::Null);
                    let has_content = !is_empty_value(&value);
                    let preview = get_content_preview(&value, 50);
                    (has_content, preview)
                } else {
                    (false, None)
                };

                Ok(NodeInfo {
                    id,
                    node_type,
                    title,
                    state,
                    position: NodePosition { x, y },
                    asset_id,
                    has_content,
                    content_preview,
                })
            })
            .map_err(|e| NodesToolError(format!("Failed to query nodes: {}", e)))?;

        let mut result: Vec<NodeInfo> = nodes.filter_map(|r| r.ok()).collect();

        // Apply filters
        if let Some(ref node_type) = args.node_type {
            let type_lower = node_type.to_lowercase();
            result.retain(|n| n.node_type.to_lowercase() == type_lower);
        }

        if let Some(ref title_contains) = args.title_contains {
            let search = title_contains.to_lowercase();
            result.retain(|n| n.title.to_lowercase().contains(&search));
        }

        if let Some(is_empty) = args.is_empty {
            result.retain(|n| if is_empty { !n.has_content } else { n.has_content });
        }

        if let Some(limit) = args.limit {
            result.truncate(limit as usize);
        }

        Ok(result)
    }
}

impl Tool for GetNodesListTool {
    const NAME: &'static str = "get_nodes_list";

    type Error = NodesToolError;
    type Args = GetNodesListArgs;
    type Output = Vec<NodeInfo>;

    async fn definition(&self, _prompt: String) -> ToolDefinition {
        ToolDefinition {
            name: "get_nodes_list".to_string(),
            description: "Query nodes on the canvas with optional filters.

Use filters to narrow down results:
- node_type: filter by type (form, image, selector, recipe, text, table, gallery, queue)
- is_empty: true = nodes with no content, false = nodes with content
- title_contains: partial match on node title (case-insensitive)
- limit: max results to return".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "node_type": {
                        "type": "string",
                        "description": "Filter by node type"
                    },
                    "is_empty": {
                        "type": "boolean",
                        "description": "Filter by content: true = empty nodes, false = nodes with content"
                    },
                    "title_contains": {
                        "type": "string",
                        "description": "Filter nodes whose title contains this text"
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
    fn test_get_nodes_list_tool_new() {
        let tool = GetNodesListTool::new("/test/path");
        assert_eq!(tool.project_path(), "/test/path");
    }

    #[test]
    fn test_get_nodes_list_args_empty() {
        let args: GetNodesListArgs = serde_json::from_str("{}").unwrap();
        assert!(args.node_type.is_none());
        assert!(args.is_empty.is_none());
        assert!(args.title_contains.is_none());
        assert!(args.limit.is_none());
    }

    #[test]
    fn test_tool_call_nonexistent_path() {
        let tool = GetNodesListTool::new("/nonexistent/path");
        let args = GetNodesListArgs {
            node_type: None,
            is_empty: None,
            title_contains: None,
            limit: None,
        };
        let result = tool.execute(&args);
        assert!(result.is_err());
    }
}
