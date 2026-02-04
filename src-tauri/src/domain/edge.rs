use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Edge {
    pub id: String,
    #[serde(rename = "type")]
    pub type_: String,
    pub source_node_id: String,
    pub target_node_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_handle: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_handle: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mapping_spec: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ui_type: Option<String>,
}
