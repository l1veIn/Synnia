//! Chat persistence types.

use serde::{Deserialize, Serialize};

/// Chat index - stores metadata for all threads.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatIndex {
    pub version: u32,
    pub threads: Vec<ThreadMetadata>,
    /// ID of the last active (selected) thread.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_active_thread_id: Option<String>,
}

impl Default for ChatIndex {
    fn default() -> Self {
        Self {
            version: 1,
            threads: vec![],
            last_active_thread_id: None,
        }
    }
}

/// Metadata for a single thread (stored in index.json).
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

/// Full thread data (stored in threads/{id}.json).
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
