//! UpdateAssetsTool - Batch update asset values.

use super::common::AssetsToolError;
use rig_core::completion::ToolDefinition;
use rig_core::tool::Tool;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::json;

/// A single asset update specification.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AssetUpdate {
    pub id: String,
    pub value: serde_json::Value,
}

/// Arguments for the update_assets tool.
#[derive(Debug, Deserialize, Serialize)]
pub struct UpdateAssetsArgs {
    pub updates: Vec<AssetUpdate>,
}

/// Result of a single asset update operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SingleAssetUpdateResult {
    pub id: String,
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Result of updating assets.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateAssetsResult {
    pub updated: u32,
    pub failed: u32,
    pub results: Vec<SingleAssetUpdateResult>,
}

/// Tool for batch updating asset values.
#[derive(Clone)]
pub struct UpdateAssetsTool {
    project_path: String,
}

impl UpdateAssetsTool {
    pub fn new(project_path: impl Into<String>) -> Self {
        Self {
            project_path: project_path.into(),
        }
    }

    pub fn project_path(&self) -> &str {
        &self.project_path
    }

    pub fn execute(&self, args: &UpdateAssetsArgs) -> Result<UpdateAssetsResult, AssetsToolError> {
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

        let mut results = Vec::new();
        let mut updated = 0u32;
        let mut failed = 0u32;

        for update in &args.updates {
            let result = self.update_single_asset(&conn, update);
            match result {
                Ok(()) => {
                    updated += 1;
                    results.push(SingleAssetUpdateResult {
                        id: update.id.clone(),
                        success: true,
                        error: None,
                    });
                }
                Err(e) => {
                    failed += 1;
                    results.push(SingleAssetUpdateResult {
                        id: update.id.clone(),
                        success: false,
                        error: Some(e.to_string()),
                    });
                }
            }
        }

        Ok(UpdateAssetsResult {
            updated,
            failed,
            results,
        })
    }

    fn update_single_asset(
        &self,
        conn: &Connection,
        update: &AssetUpdate,
    ) -> Result<(), AssetsToolError> {
        let exists: bool = conn
            .query_row(
                "SELECT 1 FROM assets WHERE id = ?1",
                rusqlite::params![&update.id],
                |_| Ok(true),
            )
            .unwrap_or(false);

        if !exists {
            return Err(AssetsToolError(format!("Asset not found: {}", update.id)));
        }

        let value_json = serde_json::to_string(&update.value)
            .map_err(|e| AssetsToolError(format!("Failed to serialize value: {}", e)))?;

        let now = chrono::Utc::now().timestamp_millis();

        conn.execute(
            "UPDATE assets SET value_json = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![&value_json, now, &update.id],
        )
        .map_err(|e| AssetsToolError(format!("Failed to update asset: {}", e)))?;

        Ok(())
    }
}

impl Tool for UpdateAssetsTool {
    const NAME: &'static str = "update_assets";

    type Error = AssetsToolError;
    type Args = UpdateAssetsArgs;
    type Output = UpdateAssetsResult;

    async fn definition(&self, _prompt: String) -> ToolDefinition {
        ToolDefinition {
            name: "update_assets".to_string(),
            description: "Batch update asset values.

Parameters:
- updates: Array of {id, value} objects
  - id: Asset ID to update
  - value: New value for the asset (overwrites existing value)".to_string(),
            parameters: json!({
                "type": "object",
                "required": ["updates"],
                "properties": {
                    "updates": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "required": ["id", "value"],
                            "properties": {
                                "id": { "type": "string", "description": "Asset ID to update" },
                                "value": { "type": "object", "description": "New value for the asset" }
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
