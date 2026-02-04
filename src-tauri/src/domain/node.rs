use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeSysMetadata {
    pub name: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub source: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_library_asset: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeMeta {
    pub sys: NodeSysMetadata,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value_meta: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ui: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ext: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodePresentation {
    pub position: NodePosition,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<NodeSize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub style: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub layout: Option<NodeLayout>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expanded: Option<NodeExpanded>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub visibility: Option<NodeVisibility>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ui: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodePosition {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeSize {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub height: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeLayout {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub docked_to: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeExpanded {
    pub collapsed: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expanded_width: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expanded_height: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub original_position: Option<NodePosition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeVisibility {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hidden: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Node {
    pub id: String,
    #[serde(rename = "type")]
    pub type_: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value_type: Option<String>,
    pub data: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub schema: Option<serde_json::Value>,
    pub meta: NodeMeta,
    pub presentation: NodePresentation,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recipe_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_ids: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub execution_state: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state_updated_at: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_reference: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub original_node_id: Option<String>,
}
