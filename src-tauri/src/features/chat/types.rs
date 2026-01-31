//! Chat persistence types.

use serde::{Deserialize, Serialize};

/// Chat index containing metadata for all threads.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatIndex {
    pub version: u32,
    pub threads: Vec<ThreadMetadata>,
}

/// Metadata for a single chat thread (stored in index.json).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThreadMetadata {
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
    pub is_archived: bool,
    pub message_count: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_id: Option<String>,
}

/// Full thread data including messages (stored in {threadId}.json).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThreadData {
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_id: Option<String>,
    /// Messages in assistant-ui format (stored as raw JSON).
    pub messages: Vec<serde_json::Value>,
}

impl Default for ChatIndex {
    fn default() -> Self {
        Self {
            version: 1,
            threads: vec![],
        }
    }
}
