use serde::{Deserialize, Serialize};
use ts_rs::TS;
use uuid::Uuid;
use chrono::{DateTime, Utc};

// ==========================================
// Enums
// ==========================================

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub enum AssetType {
    Image,
    Text,
    Prompt,
    Link, // External URL
    Grid, // e.g. 9-grid image
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub enum NodeStatus {
    Active,
    Outdated, // Upstream changed
    Archived,
    Processing, // Agent is working on it
    Error,
}

// ==========================================
// Core Structs
// ==========================================

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub created_at: String, // ISO 8601
    pub path: String, // Local file system path
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct AssetNode {
    pub id: String,
    pub project_id: String,
    pub type_: AssetType,
    pub status: NodeStatus,
    pub current_version_id: Option<String>, // Points to the active version
    
    // Position for React Flow (Canvas)
    pub x: f64,
    pub y: f64,
    
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct AssetVersion {
    pub id: String,
    pub asset_id: String,
    // The actual content. 
    // If Text/Prompt: raw string.
    // If Image: relative path to project root (e.g., "assets/xyz.png").
    pub payload: String, 
    pub meta: Option<String>, // JSON string for extra metadata (Model params, seed)
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Edge {
    pub id: String,
    pub source_id: String,
    pub target_id: String,
    
    // If Some: Computable (Solid Line). If None: Manual/Reference (Dashed Line)
    // This stores the "Recipe" used to generate the target.
    pub recipe: Option<String>, // JSON string: { agent_id: "...", params: {...} }
    
    pub created_at: String,
}
