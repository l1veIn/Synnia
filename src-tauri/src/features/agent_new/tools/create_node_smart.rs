//! CreateNodeSmartTool - Create nodes on the canvas.

use super::common::{NodePosition, NodesToolError};
use rig_core::completion::ToolDefinition;
use rig_core::tool::Tool;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::json;

/// Arguments for the create_node_smart tool.
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNodeSmartArgs {
    pub node_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub position: Option<NodePosition>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

/// Result of creating a node.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNodeResult {
    pub success: bool,
    pub node_id: String,
    pub asset_id: String,
    pub node_type: String,
    pub title: String,
}

/// Tool for creating new nodes on the canvas.
#[derive(Clone)]
pub struct CreateNodeSmartTool {
    project_path: String,
}

impl CreateNodeSmartTool {
    pub fn new(project_path: impl Into<String>) -> Self {
        Self {
            project_path: project_path.into(),
        }
    }

    pub fn project_path(&self) -> &str {
        &self.project_path
    }

    pub fn execute(&self, args: &CreateNodeSmartArgs) -> Result<CreateNodeResult, NodesToolError> {
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

        let node_id = uuid::Uuid::new_v4().to_string();
        let asset_id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp_millis();

        let title = args
            .name
            .clone()
            .unwrap_or_else(|| format!("New {}", capitalize_first(&args.node_type)));

        let position = args
            .position
            .clone()
            .unwrap_or(NodePosition { x: 100.0, y: 100.0 });

        // Create asset first
        let value_json = serde_json::to_string(&args.value.clone().unwrap_or(json!({})))
            .map_err(|e| NodesToolError(format!("Failed to serialize value: {}", e)))?;

        let sys_json = json!({
            "name": title,
            "createdAt": now,
            "updatedAt": now,
            "source": "agent",
            "isLibraryAsset": null
        })
        .to_string();

        conn.execute(
            "INSERT INTO assets (id, value_type, value_hash, value_json, sys_json, updated_at)
             VALUES (?1, '\"record\"', '', ?2, ?3, ?4)",
            rusqlite::params![&asset_id, &value_json, &sys_json, now],
        )
        .map_err(|e| NodesToolError(format!("Failed to create asset: {}", e)))?;

        // Create node
        let data_json = json!({
            "title": title,
            "assetId": asset_id,
            "state": "idle"
        })
        .to_string();

        conn.execute(
            "INSERT INTO nodes (id, type, x, y, width, height, data_json)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![
                &node_id,
                &args.node_type,
                position.x,
                position.y,
                300.0_f64,
                150.0_f64,
                &data_json
            ],
        )
        .map_err(|e| NodesToolError(format!("Failed to create node: {}", e)))?;

        Ok(CreateNodeResult {
            success: true,
            node_id,
            asset_id,
            node_type: args.node_type.clone(),
            title,
        })
    }
}

fn capitalize_first(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
    }
}

impl Tool for CreateNodeSmartTool {
    const NAME: &'static str = "create_node_smart";

    type Error = NodesToolError;
    type Args = CreateNodeSmartArgs;
    type Output = CreateNodeResult;

    async fn definition(&self, _prompt: String) -> ToolDefinition {
        ToolDefinition {
            name: "create_node_smart".to_string(),
            description: "Create a new node on the canvas with an associated asset.

Parameters:
- nodeType (required): Node type - text, image, form, recipe, selector, gallery, table, rack
- value (optional): Initial value for the node's asset (JSON object)
- position (optional): Canvas position {x, y}. Defaults to (100, 100)
- name (optional): Custom name for the node".to_string(),
            parameters: json!({
                "type": "object",
                "required": ["nodeType"],
                "properties": {
                    "nodeType": {
                        "type": "string",
                        "description": "Node type: text, image, form, recipe, selector, gallery, table, rack"
                    },
                    "value": {
                        "type": "object",
                        "description": "Initial value for the node's asset"
                    },
                    "position": {
                        "type": "object",
                        "properties": {
                            "x": { "type": "number" },
                            "y": { "type": "number" }
                        },
                        "description": "Canvas position"
                    },
                    "name": {
                        "type": "string",
                        "description": "Custom name for the node"
                    }
                }
            }),
        }
    }

    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        self.execute(&args)
    }
}
