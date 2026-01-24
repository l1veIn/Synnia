//! Recipe-related domain models.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Agent definition for custom AI agents.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct AgentDefinition {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub system_prompt: String, 
    pub input_schema: String, 
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_config: Option<String>,
    pub is_system: bool,
}
