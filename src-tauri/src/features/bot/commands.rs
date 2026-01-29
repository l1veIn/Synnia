//! Bot Commands - AI Assistant Chat
//!
//! Commands for the AI Bot feature that enables natural language interaction
//! with the Synnia canvas.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use tauri::State;

use crate::core::{AppError, AppState};
use super::persistence::{self, BotHistorySession};

// ============================================
// Types
// ============================================

/// Message role in the conversation
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export)]
pub enum BotMessageRole {
    User,
    Assistant,
    System,
}

/// A single message in the bot conversation
/// Note: Does not derive TS because serde_json::Value doesn't implement TS
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BotMessage {
    pub id: String,
    pub role: BotMessageRole,
    pub content: String,
    pub timestamp: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// A tool call made by the AI
/// Note: Does not derive TS because serde_json::Value doesn't implement TS
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub arguments: HashMap<String, serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
}

/// Tool definition passed to the AI
/// Note: Does not derive TS because serde_json::Value doesn't implement TS
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value,
}

/// Request payload for bot chat
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BotChatRequest {
    pub messages: Vec<BotMessage>,
    pub system_prompt: String,
    pub tools: Vec<ToolDefinition>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_id: Option<String>,
}

/// Response from bot chat
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BotChatResponse {
    pub message: BotMessage,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
}

/// Request to save bot history
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveBotHistoryRequest {
    pub session_id: String,
    pub messages: Vec<BotMessage>,
}

/// Response from loading bot history
#[derive(Debug, Serialize)]
pub struct LoadBotHistoryResponse {
    pub session: Option<BotHistorySession>,
}

// ============================================
// Commands
// ============================================

/// Process a chat request and return a response.
///
/// This is a minimal echo implementation for Phase 4.
/// In a full implementation, this would:
/// 1. Load API credentials from settings
/// 2. Call the appropriate LLM API
/// 3. Handle tool execution
/// 4. Return the response
///
/// For now, it returns a simple response to verify the runtime works.
#[tauri::command]
pub async fn bot_chat(request: BotChatRequest) -> Result<BotChatResponse, AppError> {
    // Phase 4: Minimal echo implementation
    // This verifies the runtime pipeline is working
    // Full LLM integration will come after toolkit implementation

    let user_message = request.messages
        .iter()
        .last()
        .and_then(|m| Some(m.content.clone()))
        .unwrap_or_else(|| String::from("Hello"));

    // Simple echo response for Phase 4 testing
    let response_content = format!(
        "I received your message: \"{}\"\n\n\
        (This is a placeholder response. Full AI integration will be implemented \
        after the bot toolkit is complete in Phase 5.)",
        user_message
    );

    let response_message = BotMessage {
        id: format!("msg_{}", chrono::Utc::now().timestamp_millis()),
        role: BotMessageRole::Assistant,
        content: response_content,
        timestamp: chrono::Utc::now().timestamp_millis(),
        tool_calls: None,
        metadata: None,
    };

    Ok(BotChatResponse {
        message: response_message,
        tool_calls: None,
    })
}

/// Save bot chat history to disk.
///
/// Stores the conversation in `{project}/.synnia/chat/{session_id}.json`.
///
/// Phase 6: Persistence implementation.
#[tauri::command]
pub async fn save_bot_history(
    state: State<'_, AppState>,
    request: SaveBotHistoryRequest,
) -> Result<(), AppError> {
    let project_path_guard = state.current_project_path.lock().unwrap();
    let project_path = project_path_guard
        .as_ref()
        .ok_or_else(|| AppError::NotFound("No project loaded".to_string()))?;

    let project_root = std::path::Path::new(project_path);
    persistence::save_chat_history(project_root, &request.session_id, &request.messages)
        .map_err(|e| AppError::Database(e))?;

    Ok(())
}

/// Load bot chat history from disk.
///
/// Phase 6: Persistence implementation.
#[tauri::command]
pub async fn load_bot_history(
    state: State<'_, AppState>,
    session_id: Option<String>,
) -> Result<LoadBotHistoryResponse, AppError> {
    let project_path_guard = state.current_project_path.lock().unwrap();
    let project_path = project_path_guard
        .as_ref()
        .ok_or_else(|| AppError::NotFound("No project loaded".to_string()))?;

    let project_root = std::path::Path::new(project_path);

    let session = if let Some(sid) = session_id {
        // Load specific session
        Some(persistence::load_chat_history(project_root, &sid)
            .map_err(|e| AppError::Database(e))?)
    } else {
        // Load most recent session
        persistence::load_recent_chat_history(project_root)
            .map_err(|e| AppError::Database(e))?
    };

    Ok(LoadBotHistoryResponse { session })
}

/// List all bot chat sessions.
///
/// Returns metadata for all chat sessions in the project.
///
/// Phase 6: Persistence implementation.
#[tauri::command]
pub async fn list_bot_sessions(
    state: State<'_, AppState>,
) -> Result<Vec<persistence::BotSessionMeta>, AppError> {
    let project_path_guard = state.current_project_path.lock().unwrap();
    let project_path = project_path_guard
        .as_ref()
        .ok_or_else(|| AppError::NotFound("No project loaded".to_string()))?;

    let project_root = std::path::Path::new(project_path);
    let sessions = persistence::list_chat_sessions(project_root)
        .map_err(|e| AppError::Database(e))?;

    Ok(sessions)
}

/// Delete a bot chat session.
///
/// Phase 6: Persistence implementation.
#[tauri::command]
pub async fn delete_bot_session(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), AppError> {
    let project_path_guard = state.current_project_path.lock().unwrap();
    let project_path = project_path_guard
        .as_ref()
        .ok_or_else(|| AppError::NotFound("No project loaded".to_string()))?;

    let project_root = std::path::Path::new(project_path);
    persistence::delete_chat_session(project_root, &session_id)
        .map_err(|e| AppError::Database(e))?;

    Ok(())
}

// ============================================
// Tests
// ============================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bot_chat_request_serialization() {
        let request = BotChatRequest {
            messages: vec![BotMessage {
                id: "test_msg".to_string(),
                role: BotMessageRole::User,
                content: "Hello".to_string(),
                timestamp: 12345,
                tool_calls: None,
                metadata: None,
            }],
            system_prompt: "You are a helpful assistant.".to_string(),
            tools: vec![],
            model_id: None,
        };

        // Verify it can serialize to JSON
        let json = serde_json::to_string(&request);
        assert!(json.is_ok());

        // Verify it can deserialize back
        let deserialized: Result<BotChatRequest, _> = serde_json::from_str(&json.unwrap());
        assert!(deserialized.is_ok());
    }

    #[test]
    fn test_tool_definition_serialization() {
        let tool = ToolDefinition {
            name: "test_tool".to_string(),
            description: "A test tool".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "param1": {"type": "string"}
                }
            }),
        };

        let json = serde_json::to_string(&tool).unwrap();
        assert!(json.contains("test_tool"));
    }
}
