//! DeleteNodesTool - Delete nodes with Human-in-the-Loop confirmation.

use super::common::NodesToolError;
use rig_core::completion::ToolDefinition;
use rig_core::tool::Tool;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::json;

/// Arguments for the delete_nodes tool.
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteNodesArgs {
    pub node_ids: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confirmed: Option<bool>,
}

/// Information about a node to be deleted.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteNodeInfo {
    pub id: String,
    pub title: String,
    pub node_type: String,
}

/// Result of the delete operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "status")]
pub enum DeleteNodesResult {
    #[serde(rename = "pending")]
    Pending {
        nodes: Vec<DeleteNodeInfo>,
        message: String,
    },
    #[serde(rename = "confirmed")]
    Confirmed { deleted: u32 },
    #[serde(rename = "cancelled")]
    Cancelled { message: String },
}

/// Tool for deleting nodes from the canvas.
///
/// Implements Human-in-the-Loop (HITL) protocol:
/// 1. First call without `confirmed` returns pending status with node info
/// 2. Frontend displays confirmation dialog
/// 3. Second call with `confirmed: true` executes deletion
/// 4. Or `confirmed: false` cancels the operation
#[derive(Clone)]
pub struct DeleteNodesTool {
    project_path: String,
}

impl DeleteNodesTool {
    pub fn new(project_path: impl Into<String>) -> Self {
        Self {
            project_path: project_path.into(),
        }
    }

    pub fn project_path(&self) -> &str {
        &self.project_path
    }

    pub fn execute(&self, args: &DeleteNodesArgs) -> Result<DeleteNodesResult, NodesToolError> {
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

        match args.confirmed {
            Some(false) => Ok(DeleteNodesResult::Cancelled {
                message: "Delete operation cancelled by user".to_string(),
            }),

            Some(true) => {
                let mut deleted = 0u32;

                for node_id in &args.node_ids {
                    let asset_id: Option<String> = conn
                        .query_row(
                            "SELECT json_extract(data_json, '$.assetId') FROM nodes WHERE id = ?1",
                            rusqlite::params![node_id],
                            |row| row.get(0),
                        )
                        .ok();

                    let rows = conn
                        .execute("DELETE FROM nodes WHERE id = ?1", rusqlite::params![node_id])
                        .unwrap_or(0);

                    if rows > 0 {
                        deleted += 1;

                        if let Some(aid) = asset_id {
                            let is_library: Option<bool> = conn
                                .query_row(
                                    "SELECT json_extract(sys_json, '$.isLibraryAsset') FROM assets WHERE id = ?1",
                                    rusqlite::params![&aid],
                                    |row| row.get(0),
                                )
                                .ok()
                                .flatten();

                            if is_library != Some(true) {
                                let _ = conn.execute(
                                    "DELETE FROM assets WHERE id = ?1",
                                    rusqlite::params![&aid],
                                );
                            }
                        }
                    }
                }

                Ok(DeleteNodesResult::Confirmed { deleted })
            }

            None => {
                let mut nodes = Vec::new();

                for node_id in &args.node_ids {
                    let node_info: Option<(String, String)> = conn
                        .query_row(
                            "SELECT type, data_json FROM nodes WHERE id = ?1",
                            rusqlite::params![node_id],
                            |row| Ok((row.get(0)?, row.get(1)?)),
                        )
                        .ok();

                    if let Some((node_type, data_json)) = node_info {
                        let data: serde_json::Value =
                            serde_json::from_str(&data_json).unwrap_or(json!({}));
                        let title = data
                            .get("title")
                            .and_then(|v| v.as_str())
                            .unwrap_or("Untitled")
                            .to_string();

                        nodes.push(DeleteNodeInfo {
                            id: node_id.clone(),
                            title,
                            node_type,
                        });
                    }
                }

                let count = nodes.len();
                Ok(DeleteNodesResult::Pending {
                    nodes,
                    message: format!("This will delete {} node(s). Please confirm.", count),
                })
            }
        }
    }
}

impl Tool for DeleteNodesTool {
    const NAME: &'static str = "delete_nodes";

    type Error = NodesToolError;
    type Args = DeleteNodesArgs;
    type Output = DeleteNodesResult;

    async fn definition(&self, _prompt: String) -> ToolDefinition {
        ToolDefinition {
            name: "delete_nodes".to_string(),
            description: "Delete nodes from the canvas. Requires user confirmation (Human-in-the-Loop).

First call returns pending status with node information for user to review.
Use confirmed=true to execute deletion, or confirmed=false to cancel.

Parameters:
- nodeIds (required): Array of node IDs to delete
- confirmed (optional): true to confirm deletion, false to cancel".to_string(),
            parameters: json!({
                "type": "object",
                "required": ["nodeIds"],
                "properties": {
                    "nodeIds": {
                        "type": "array",
                        "items": { "type": "string" },
                        "description": "Array of node IDs to delete"
                    },
                    "confirmed": {
                        "type": "boolean",
                        "description": "Set to true to confirm deletion, false to cancel"
                    }
                }
            }),
        }
    }

    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        self.execute(&args)
    }
}
