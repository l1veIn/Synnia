//! Node query tool for agent.
//!
//! This module provides a tool that allows the AI agent to query
//! nodes in the current project's database.
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
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::features::agent::types::AgentResult;

/// Arguments for the get_nodes_list tool.
#[derive(Debug, Deserialize, Serialize)]
pub struct GetNodesListArgs {
    /// Optional filter for node type (e.g., "form", "image", "text", "recipe")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub node_type: Option<String>,
    /// If true, only return nodes that have no content (empty asset)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_empty: Option<bool>,
    /// Filter nodes whose title contains this text (case-insensitive)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title_contains: Option<String>,
    /// Maximum number of results to return
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<u32>,
}

/// Information about a single node.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeInfo {
    /// Unique identifier for the node
    pub id: String,
    /// Node type (e.g., "image", "text", "form", "recipe")
    pub node_type: String,
    /// Node title or name
    pub title: String,
    /// Node state (e.g., "idle", "running", "error")
    pub state: String,
    /// Node position on canvas
    pub position: NodePosition,
    /// Associated asset ID if present
    #[serde(skip_serializing_if = "Option::is_none")]
    pub asset_id: Option<String>,
    /// Whether the node has content
    pub has_content: bool,
    /// Brief preview of content
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_preview: Option<String>,
}

/// Node position on canvas.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodePosition {
    pub x: f64,
    pub y: f64,
}

/// Tool for getting the list of nodes in the current project.
///
/// This tool reads nodes from the project's SQLite database and returns
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
    pub fn execute(&self, args: &GetNodesListArgs) -> AgentResult<Vec<NodeInfo>> {
        let project_path = std::path::Path::new(&self.project_path);
        let db_path = project_path.join("synnia.db");

        if !db_path.exists() {
            return Err(crate::features::agent::types::AgentError::ToolError(format!(
                "Project database not found: {}",
                db_path.display()
            )));
        }

        let conn = Connection::open(&db_path).map_err(|e| {
            crate::features::agent::types::AgentError::ToolError(format!(
                "Failed to open database: {}",
                e
            ))
        })?;

        self.query_nodes(&conn, args)
    }

    fn query_nodes(&self, conn: &Connection, args: &GetNodesListArgs) -> AgentResult<Vec<NodeInfo>> {
        // Query nodes from database
        let mut stmt = conn
            .prepare(
                "SELECT n.id, n.type, n.x, n.y, n.data_json, a.value_json
                 FROM nodes n
                 LEFT JOIN assets a ON json_extract(n.data_json, '$.assetId') = a.id",
            )
            .map_err(|e| {
                crate::features::agent::types::AgentError::ToolError(format!(
                    "Failed to prepare query: {}",
                    e
                ))
            })?;

        let nodes = stmt
            .query_map([], |row| {
                let id: String = row.get(0)?;
                let node_type: String = row.get(1)?;
                let x: f64 = row.get(2)?;
                let y: f64 = row.get(3)?;
                let data_json: String = row.get(4)?;
                let asset_value_json: Option<String> = row.get(5)?;

                // Parse data_json to extract title, state, and assetId
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

                // Determine if node has content based on asset value
                let (has_content, content_preview) = if let Some(ref value_json) = asset_value_json
                {
                    let value: serde_json::Value =
                        serde_json::from_str(value_json).unwrap_or(serde_json::Value::Null);
                    let has_content = !is_empty_value(&value);
                    let preview = get_content_preview(&value);
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
            .map_err(|e| {
                crate::features::agent::types::AgentError::ToolError(format!(
                    "Failed to query nodes: {}",
                    e
                ))
            })?;

        let mut result: Vec<NodeInfo> = nodes
            .filter_map(|r| r.ok())
            .collect();

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

        // Apply limit
        if let Some(limit) = args.limit {
            result.truncate(limit as usize);
        }

        Ok(result)
    }
}

/// Check if a JSON value is "empty" (null, empty object, or empty array).
fn is_empty_value(value: &serde_json::Value) -> bool {
    match value {
        serde_json::Value::Null => true,
        serde_json::Value::Object(obj) => obj.is_empty(),
        serde_json::Value::Array(arr) => arr.is_empty(),
        serde_json::Value::String(s) => s.is_empty(),
        _ => false,
    }
}

/// Get a brief preview of content for LLM context.
fn get_content_preview(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::Object(obj) => {
            if obj.is_empty() {
                return None;
            }
            let keys: Vec<&str> = obj.keys().map(|s| s.as_str()).take(3).collect();
            let suffix = if obj.len() > 3 { "..." } else { "" };
            Some(format!("{} fields: {}{}", obj.len(), keys.join(", "), suffix))
        }
        serde_json::Value::Array(arr) => {
            if arr.is_empty() {
                return None;
            }
            Some(format!("{} items", arr.len()))
        }
        serde_json::Value::String(s) => {
            if s.is_empty() {
                return None;
            }
            let preview = if s.len() > 50 {
                format!("{}...", &s[..50])
            } else {
                s.clone()
            };
            Some(preview)
        }
        _ => None,
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
            description: "Query nodes on the canvas with optional filters. Returns node id, type, title, state, position, and content info.

Use filters to narrow down results:
- node_type: filter by type (form, image, selector, recipe, text, table, gallery, queue)
- is_empty: true = nodes with no content, false = nodes with content
- title_contains: partial match on node title (case-insensitive)
- limit: max results to return

Examples:
- Query all form nodes: { \"node_type\": \"form\" }
- Query empty forms: { \"node_type\": \"form\", \"is_empty\": true }
- Query images with content: { \"node_type\": \"image\", \"is_empty\": false }".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "node_type": {
                        "type": "string",
                        "description": "Filter by node type: form, image, selector, recipe, text, table, gallery, queue"
                    },
                    "is_empty": {
                        "type": "boolean",
                        "description": "Filter by content: true = empty nodes, false = nodes with content"
                    },
                    "title_contains": {
                        "type": "string",
                        "description": "Filter nodes whose title contains this text (case-insensitive)"
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
        let args = GetNodesListArgs {
            node_type: None,
            is_empty: None,
            title_contains: None,
            limit: None,
        };
        assert!(args.node_type.is_none());
    }

    #[test]
    fn test_get_nodes_list_args_with_type() {
        let args = GetNodesListArgs {
            node_type: Some("image".to_string()),
            is_empty: Some(false),
            title_contains: None,
            limit: Some(10),
        };
        assert_eq!(args.node_type, Some("image".to_string()));
    }

    #[test]
    fn test_node_info_serialization() {
        let node = NodeInfo {
            id: "123".to_string(),
            node_type: "image".to_string(),
            title: "My Photo".to_string(),
            state: "idle".to_string(),
            position: NodePosition { x: 100.0, y: 200.0 },
            asset_id: Some("asset-1".to_string()),
            has_content: true,
            content_preview: Some("3 fields: a, b, c".to_string()),
        };

        let json = serde_json::to_string(&node).unwrap();
        assert!(json.contains("\"id\":\"123\""));
        assert!(json.contains("\"nodeType\":\"image\""));
    }

    #[test]
    fn test_is_empty_value() {
        assert!(is_empty_value(&serde_json::Value::Null));
        assert!(is_empty_value(&serde_json::json!({})));
        assert!(is_empty_value(&serde_json::json!([])));
        assert!(is_empty_value(&serde_json::json!("")));
        assert!(!is_empty_value(&serde_json::json!({"key": "value"})));
        assert!(!is_empty_value(&serde_json::json!([1, 2, 3])));
    }

    #[test]
    fn test_get_content_preview() {
        assert_eq!(
            get_content_preview(&serde_json::json!({"a": 1, "b": 2})),
            Some("2 fields: a, b".to_string())
        );
        assert_eq!(
            get_content_preview(&serde_json::json!([1, 2, 3])),
            Some("3 items".to_string())
        );
        assert_eq!(
            get_content_preview(&serde_json::json!("hello")),
            Some("hello".to_string())
        );
        assert_eq!(get_content_preview(&serde_json::json!(null)), None);
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
        let args = GetNodesListArgs {
            node_type: None,
            is_empty: None,
            title_contains: None,
            limit: None,
        };

        let result = tool.call(args).await;
        assert!(result.is_err());
    }
}

