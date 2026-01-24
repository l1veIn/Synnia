//! Graph system domain models (View Layer).

use serde::{Deserialize, Serialize};
use ts_rs::TS;
use std::collections::HashMap;

/// Graph container for nodes and edges.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct Graph {
    pub nodes: Vec<SynniaNode>,
    pub edges: Vec<SynniaEdge>,
}

/// Viewport state (pan and zoom).
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct Viewport {
    pub x: f64,
    pub y: f64,
    pub zoom: f64,
}

/// A node in the graph.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct SynniaNode {
    pub id: String,
    #[serde(rename = "type")]
    pub type_: String,
    pub position: Position,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub height: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extent: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(type = "Record<string, any>")]
    pub style: Option<HashMap<String, serde_json::Value>>,

    pub data: SynniaNodeData,
}

/// Position coordinates.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

/// Node data payload.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct SynniaNodeData {
    pub title: String,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub asset_id: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_reference: Option<bool>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub collapsed: Option<bool>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub layout_mode: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub docked_to: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub state: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub recipe_id: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub has_product_handle: Option<bool>,
}

/// An edge connecting two nodes.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct SynniaEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_handle: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_handle: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "type")]
    pub type_: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub animated: Option<bool>,
}
