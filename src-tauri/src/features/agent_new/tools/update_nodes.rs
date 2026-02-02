//! UpdateNodesTool - Batch update node data.

use super::common::NodesToolError;
use rig_core::completion::ToolDefinition;
use rig_core::tool::Tool;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::json;

/// A single node update specification.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct NodeUpdate {
    pub id: String,
    pub data: serde_json::Value,
}

/// Arguments for the update_nodes tool.
#[derive(Debug, Deserialize, Serialize)]
pub struct UpdateNodesArgs {
    pub updates: Vec<NodeUpdate>,
}

/// Result of a single update operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SingleUpdateResult {
    pub id: String,
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Result of updating nodes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateNodesResult {
    pub updated: u32,
    pub failed: u32,
    pub results: Vec<SingleUpdateResult>,
}

/// Tool for batch updating node data.
#[derive(Clone)]
pub struct UpdateNodesTool {
    project_path: String,
}

impl UpdateNodesTool {
    pub fn new(project_path: impl Into<String>) -> Self {
        Self {
            project_path: project_path.into(),
        }
    }

    pub fn project_path(&self) -> &str {
        &self.project_path
    }

    pub fn execute(&self, args: &UpdateNodesArgs) -> Result<UpdateNodesResult, NodesToolError> {
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

        let mut results = Vec::new();
        let mut updated = 0u32;
        let mut failed = 0u32;

        for update in &args.updates {
            let result = self.update_single_node(&conn, update);
            match result {
                Ok(()) => {
                    updated += 1;
                    results.push(SingleUpdateResult {
                        id: update.id.clone(),
                        success: true,
                        error: None,
                    });
                }
                Err(e) => {
                    failed += 1;
                    results.push(SingleUpdateResult {
                        id: update.id.clone(),
                        success: false,
                        error: Some(e.to_string()),
                    });
                }
            }
        }

        Ok(UpdateNodesResult {
            updated,
            failed,
            results,
        })
    }

    fn update_single_node(
        &self,
        conn: &Connection,
        update: &NodeUpdate,
    ) -> Result<(), NodesToolError> {
        let current_data_json: String = conn
            .query_row(
                "SELECT data_json FROM nodes WHERE id = ?1",
                rusqlite::params![&update.id],
                |row| row.get(0),
            )
            .map_err(|e| NodesToolError(format!("Node not found: {}", e)))?;

        let mut current_data: serde_json::Value =
            serde_json::from_str(&current_data_json).unwrap_or(json!({}));

        if let (Some(current_obj), Some(update_obj)) =
            (current_data.as_object_mut(), update.data.as_object())
        {
            for (key, value) in update_obj {
                current_obj.insert(key.clone(), value.clone());
            }
        }

        let new_data_json = serde_json::to_string(&current_data)
            .map_err(|e| NodesToolError(format!("Failed to serialize data: {}", e)))?;

        conn.execute(
            "UPDATE nodes SET data_json = ?1 WHERE id = ?2",
            rusqlite::params![&new_data_json, &update.id],
        )
        .map_err(|e| NodesToolError(format!("Failed to update node: {}", e)))?;

        Ok(())
    }
}

impl Tool for UpdateNodesTool {
    const NAME: &'static str = "update_nodes";

    type Error = NodesToolError;
    type Args = UpdateNodesArgs;
    type Output = UpdateNodesResult;

    async fn definition(&self, _prompt: String) -> ToolDefinition {
        ToolDefinition {
            name: "update_nodes".to_string(),
            description: "Batch update node data. Only specified fields will be changed.

Parameters:
- updates: Array of {id, data} objects
  - id: Node ID to update
  - data: Partial data to merge into node.data".to_string(),
            parameters: json!({
                "type": "object",
                "required": ["updates"],
                "properties": {
                    "updates": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "required": ["id", "data"],
                            "properties": {
                                "id": { "type": "string", "description": "Node ID to update" },
                                "data": { "type": "object", "description": "Partial data to merge" }
                            }
                        }
                    }
                }
            }),
        }
    }

    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        self.execute(&args)
    }
}
