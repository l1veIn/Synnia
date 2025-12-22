use serde::{Deserialize, Serialize};
use ts_rs::TS;
use std::collections::HashMap;

// ========================================== 
// Synnia Architecture V2 Models
// ========================================== 

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct SynniaProject {
    pub version: String,
    pub meta: ProjectMeta,
    pub viewport: Viewport,
    pub graph: Graph,
    
    // V2: Central Asset Registry
    #[ts(type = "Record<string, Asset>")]
    pub assets: HashMap<String, Asset>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(type = "Record<string, any>")]
    pub settings: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMeta {
    pub id: String,
    pub name: String,
    pub created_at: String, // ISO String or Timestamp
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thumbnail: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
}

// ========================================== 
// Asset System (Data Layer)
// New unified structure with discriminated union
// ========================================== 

/// ValueType enum for Asset discrimination
#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[ts(export)]
#[serde(rename_all = "lowercase")]
pub enum ValueType {
    Text,
    Image,
    Record,
    Array,
}

/// System metadata - tracks asset lifecycle
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct AssetSysMetadata {
    pub name: String,
    #[ts(type = "number")]
    pub created_at: i64,
    #[ts(type = "number")]
    pub updated_at: i64,
    pub source: String, // "user", "ai", "import"
}

/// Value metadata for text assets
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct TextValueMeta {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preview: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub length: Option<u64>,
}

/// Config for text assets
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct TextAssetConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub format: Option<String>, // "markdown" | "plain" | "json"
}

/// Value metadata for image assets
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct ImageValueMeta {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preview: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub height: Option<u32>,
}

/// Config for image assets
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct ImageAssetConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mime_type: Option<String>,
}

/// Value metadata for record assets
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct RecordValueMeta {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preview: Option<String>,
}

/// Config for record assets (forms)
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct RecordAssetConfig {
    #[ts(type = "any[]")]
    pub schema: serde_json::Value, // FieldDefinition[]
}

/// Value metadata for array assets
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct ArrayValueMeta {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub length: Option<u64>,
}

/// Config for array assets (tables, selectors, galleries)
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct ArrayAssetConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(type = "any[]")]
    pub item_schema: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(type = "any[]")]
    pub columns: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(type = "any[]")]
    pub options: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mode: Option<String>, // "single" | "multi"
}

/// Unified Asset structure with discriminated union
/// Frontend uses valueType to determine the asset variant
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct Asset {
    pub id: String,
    pub value_type: ValueType,
    
    #[ts(type = "any")]
    pub value: serde_json::Value,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(type = "any")]
    pub value_meta: Option<serde_json::Value>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(type = "any")]
    pub config: Option<serde_json::Value>,
    
    pub sys: AssetSysMetadata,
}


// ========================================== 
// Graph System (View Layer)
// ========================================== 

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct Graph {
    pub nodes: Vec<SynniaNode>,
    pub edges: Vec<SynniaEdge>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct Viewport {
    pub x: f64,
    pub y: f64,
    pub zoom: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct SynniaNode {
    pub id: String,
    pub type_: String, // "asset-node", "group", "note", etc.
    pub position: Position,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub height: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extent: Option<String>, // "parent" or undefined
    
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(type = "Record<string, any>")]
    pub style: Option<HashMap<String, serde_json::Value>>,

    pub data: SynniaNodeData,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct SynniaNodeData {
    pub title: String,
    
    // V2: Asset Pointer & View State
    #[serde(skip_serializing_if = "Option::is_none")]
    pub asset_id: Option<String>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_reference: Option<bool>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub collapsed: Option<bool>, // Rack / Group collapse state
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub layout_mode: Option<String>, // "free", "rack", "grid"

    // New Feature: Docking
    #[serde(skip_serializing_if = "Option::is_none")]
    pub docked_to: Option<String>,

    // Generic State
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state: Option<String>, // "idle", "running", "error"

    // Recipe Node: Recipe Definition ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recipe_id: Option<String>,

    // Product Node: Has Output Edge connection point
    #[serde(skip_serializing_if = "Option::is_none")]
    pub has_product_handle: Option<bool>,
}

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
    pub type_: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub animated: Option<bool>,
}

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

// ========================================== 
// Tests & Binding Generation
// ========================================== 

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use ts_rs::TS;

    // Note: ts-rs now exports to bindings/ directory automatically via #[ts(export)]
    // Run `cargo test export_bindings` to regenerate, then `./fix-bindings.sh` to fix imports
}