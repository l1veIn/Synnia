//! Common types and utilities shared across tools.

use serde::{Deserialize, Serialize};

/// Node position on canvas.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodePosition {
    pub x: f64,
    pub y: f64,
}

/// Custom error type for node-related tools.
#[derive(Debug, thiserror::Error)]
#[error("Nodes tool error: {0}")]
pub struct NodesToolError(pub String);

/// Custom error type for asset-related tools.
#[derive(Debug, thiserror::Error)]
#[error("Assets tool error: {0}")]
pub struct AssetsToolError(pub String);

/// Check if a JSON value is "empty" (null, empty object, or empty array).
pub fn is_empty_value(value: &serde_json::Value) -> bool {
    match value {
        serde_json::Value::Null => true,
        serde_json::Value::Object(map) => map.is_empty(),
        serde_json::Value::Array(arr) => arr.is_empty(),
        serde_json::Value::String(s) => s.is_empty(),
        _ => false,
    }
}

/// Get a brief preview of content for LLM context.
pub fn get_content_preview(value: &serde_json::Value, max_len: usize) -> Option<String> {
    if is_empty_value(value) {
        return None;
    }

    let preview = match value {
        serde_json::Value::String(s) => {
            if s.len() > max_len {
                format!("{}...", &s[..max_len])
            } else {
                s.clone()
            }
        }
        serde_json::Value::Object(map) => {
            let keys: Vec<&String> = map.keys().take(5).collect();
            if keys.is_empty() {
                return None;
            }
            format!("{{{}...}}", keys.iter().map(|k| k.as_str()).collect::<Vec<_>>().join(", "))
        }
        serde_json::Value::Array(arr) => {
            format!("[{} items]", arr.len())
        }
        _ => value.to_string(),
    };

    Some(preview)
}
