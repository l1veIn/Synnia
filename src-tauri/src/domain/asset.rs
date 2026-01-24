//! Asset system domain models.
//!
//! The Form-Centric Model:
//! - Record: Single structured form (TextNode, ImageNode, FormNode, RecipeNode)
//! - Array: Collection of records (TableNode, GalleryNode, SelectorNode)

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// ValueType enum for Asset discrimination.
#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[ts(export)]
#[serde(rename_all = "lowercase")]
pub enum ValueType {
    Record,
    Array,
}

impl ValueType {
    pub fn as_str(&self) -> &'static str {
        match self {
            ValueType::Record => "record",
            ValueType::Array => "array",
        }
    }
}

/// System metadata - tracks asset lifecycle.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct AssetSysMetadata {
    pub name: String,
    #[ts(type = "number")]
    pub created_at: i64,
    #[ts(type = "number")]
    pub updated_at: i64,
    /// Source of the asset: "user", "ai", "import"
    pub source: String,
    /// If true, asset is shown in Asset Library and preserved when node is deleted
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_library_asset: Option<bool>,
}

/// Unified Asset Metadata (stored in config.meta).
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct AssetMeta {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preview: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub length: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub height: Option<u32>,
}

/// Config for record assets (forms, text, image).
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct RecordAssetConfig {
    #[ts(type = "any[]")]
    pub schema: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meta: Option<AssetMeta>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recipe_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(type = "any")]
    pub model_config: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(type = "any")]
    pub chat_context: Option<serde_json::Value>,
}

/// Config for array assets (tables, selectors, galleries).
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct ArrayAssetConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(type = "any[]")]
    pub schema: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meta: Option<AssetMeta>,
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
    pub mode: Option<String>,
}

/// Unified Asset structure (Form-Centric Model).
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct Asset {
    pub id: String,
    pub value_type: ValueType,
    
    #[ts(type = "any")]
    pub value: serde_json::Value,
    
    /// Backend-generated metadata (dimensions, preview, length)
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional, type = "any")]
    pub value_meta: Option<serde_json::Value>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional, type = "any")]
    pub config: Option<serde_json::Value>,
    
    pub sys: AssetSysMetadata,
}
