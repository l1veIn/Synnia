//! Project-level domain models.

use serde::{Deserialize, Serialize};
use ts_rs::TS;
use std::collections::HashMap;

use super::asset::Asset;
use super::graph::{Graph, Viewport};

/// The root project structure.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct SynniaProject {
    pub version: String,
    pub meta: ProjectMeta,
    pub viewport: Viewport,
    pub graph: Graph,
    
    /// Central Asset Registry
    #[ts(type = "Record<string, Asset>")]
    pub assets: HashMap<String, Asset>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(type = "Record<string, any>")]
    pub settings: Option<HashMap<String, serde_json::Value>>,
}

/// Project metadata.
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
