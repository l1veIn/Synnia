use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionRun {
    pub run_id: String,
    pub recipe_id: String,
    pub input_node_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_node_id: Option<String>,
    pub state: String,
    pub started_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token_input: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token_output: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub logs: Option<serde_json::Value>,
}
