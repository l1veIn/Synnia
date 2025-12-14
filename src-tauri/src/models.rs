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
// ========================================== 

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct Asset {
    pub id: String,
    pub type_: String, // "text", "image", "recipe", "video", etc.
    
    // Content can be a String, a complex Object, or a File Path (handled by Rust)
    #[ts(type = "any")]
    pub content: serde_json::Value, 
    
    pub metadata: AssetMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct AssetMetadata {
    pub name: String,
    #[ts(type = "number")]
    pub created_at: i64,
    #[ts(type = "number")]
    pub updated_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>, // "user", "generated", "imported"
    
    // Type-specific metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image: Option<ImageAssetMetadata>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<TextAssetMetadata>,
    
    // Flexible extra data
    #[serde(default)]
    #[ts(type = "Record<string, any>")]
    pub extra: HashMap<String, serde_json::Value>,
}

/// Metadata specific to image assets
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct ImageAssetMetadata {
    pub width: u32,
    pub height: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mime_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thumbnail: Option<String>, // Relative path to thumbnail
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hash: Option<String>,
}

/// Metadata specific to text assets
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct TextAssetMetadata {
    pub length: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub encoding: Option<String>,
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