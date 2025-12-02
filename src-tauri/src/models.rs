use serde::{Deserialize, Serialize};
use ts_rs::TS;
use std::collections::HashMap;

// ==========================================
// Core Structs (SPF v3.1 - Hash Consistency)
// ==========================================

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct SynniaProject {
    pub version: String,
    pub meta: ProjectMeta,
    pub viewport: Viewport,
    pub graph: Graph,
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
    pub created_at: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thumbnail: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
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
pub struct Graph {
    pub nodes: Vec<SynniaNode>,
    pub edges: Vec<SynniaEdge>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct SynniaNode {
    pub id: String,
    pub type_: String, // Always "Asset" for ReactFlow compatibility
    pub position: Position,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub height: Option<f64>,
    pub data: AssetData,
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
pub struct AssetData {
    pub asset_type: String,
    pub status: NodeStatus,
    
    // Content Fingerprint for Consistency Check
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hash: Option<String>,

    // Core Properties (KV Store)
    #[ts(type = "Record<string, any>")]
    pub properties: HashMap<String, serde_json::Value>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub provenance: Option<Provenance>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(type = "string[]")]
    pub validation_errors: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[ts(export)]
#[serde(rename_all = "lowercase")] 
pub enum NodeStatus {
    Idle,
    Processing,
    Success,
    Error,
    Stale, // Upstream hash mismatch
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct Provenance {
    pub recipe_id: String,
    #[ts(type = "number")]
    pub generated_at: i64, // Timestamp
    pub sources: Vec<ProvenanceSource>,
    #[ts(type = "Record<string, any>")]
    pub params_snapshot: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct ProvenanceSource {
    pub node_id: String,
    pub node_version: i32, // Keep for human readable history
    #[serde(skip_serializing_if = "Option::is_none")]
    pub node_hash: Option<String>, // For automated stale checks
    #[serde(skip_serializing_if = "Option::is_none")]
    pub slot: Option<String>,
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

    #[test]
    fn export_bindings() {
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let bindings_dir = manifest_dir.parent().unwrap().join("src").join("bindings");

        if !bindings_dir.exists() {
            std::fs::create_dir_all(&bindings_dir).unwrap();
        }

        let mut file_content = String::from("// This file is auto-generated by Rust. Do not edit.\n\n");

        macro_rules! export_type {
            ($t:ty) => {
                file_content.push_str(&format!("// {}\n", stringify!($t)));
                file_content.push_str("export "); 
                file_content.push_str(&<$t>::decl());
                file_content.push_str("\n\n");
            };
        }

        export_type!(NodeStatus);
        export_type!(SynniaProject);
        export_type!(SynniaNode);
        export_type!(SynniaEdge);
        export_type!(AssetData);
        export_type!(Provenance);
        export_type!(ProvenanceSource);
        export_type!(AgentDefinition);
        export_type!(ProjectMeta);
        export_type!(Viewport);
        export_type!(Graph);
        export_type!(Position);

        let output_path = bindings_dir.join("synnia.ts");
        std::fs::write(output_path, file_content).unwrap();
    }
}