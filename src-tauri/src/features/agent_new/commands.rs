//! Tauri command handlers for the agent_new module.
//!
//! This module exposes the agent functionality to the frontend through Tauri commands.
//! It provides thread management, message persistence, and agent execution capabilities.

use crate::core::AppState;  // Use global AppState instead of custom state
use crate::features::agent_new::executor::{AgentExecutor, ExecutorError, StreamEvent};
use crate::features::agent_new::storage::{
    create_thread, delete_thread, get_messages, get_thread, get_threads, save_message,
    thread_exists, update_thread_title, ThreadInfo,
};
use tauri::{Emitter, State, Window};

// ============================================================================
// Helper Functions
// ============================================================================

/// Get project path from AppState.
/// 
/// This reuses the global project path managed by the project module,
/// avoiding duplicate state.
fn get_project_path_from_state(state: &AppState) -> Result<String, String> {
    let guard = state.current_project_path.lock()
        .map_err(|_| "Failed to lock project path")?;
    guard.clone().ok_or_else(|| "No project loaded".to_string())
}

// ============================================================================
// Request/Response Types
// ============================================================================

/// Request to create a new thread.
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateThreadRequest {
    /// Initial title for the thread
    pub title: Option<String>,
    /// Model ID to use for this thread
    pub model_id: String,
    /// Provider name (e.g., "google", "openai")
    pub provider: String,
}

/// Response when creating a new thread.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateThreadResponse {
    /// The new thread ID
    pub thread_id: String,
    /// The thread title
    pub title: String,
}

/// Request to send a chat message.
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatRequest {
    /// Thread ID (creates new if None)
    pub thread_id: Option<String>,
    /// User message content
    pub content: String,
    /// Model ID to use
    pub model_id: String,
    /// Provider name
    pub provider: String,
    /// Whether the model supports streaming
    pub supports_streaming: Option<bool>,
}

/// Response when sending a non-streaming chat message.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatResponse {
    /// The thread ID
    pub thread_id: String,
    /// The assistant's message ID
    pub message_id: String,
    /// The response content
    pub content: String,
    /// Model used
    pub model_id: String,
    /// Provider used
    pub provider: String,
}

/// Request to update a thread.
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateThreadRequest {
    /// Thread ID to update
    pub thread_id: String,
    /// New title (optional)
    pub title: Option<String>,
}

// ============================================================================
// Thread Commands
// ============================================================================

/// Get all threads for the current project.
///
/// Returns threads ordered by most recently updated.
#[tauri::command]
pub fn get_threads_command(
    state: State<'_, AppState>,
) -> Result<Vec<ThreadInfo>, String> {
    let project_path = get_project_path_from_state(&state)?;
    get_threads(&project_path).map_err(|e| e.to_string())
}

/// Get a specific thread by ID.
#[tauri::command]
pub fn get_thread_command(
    state: State<'_, AppState>,
    thread_id: String,
) -> Result<Option<ThreadInfo>, String> {
    let project_path = get_project_path_from_state(&state)?;
    get_thread(&project_path, &thread_id).map_err(|e| e.to_string())
}

/// Create a new thread.
#[tauri::command]
pub fn create_thread_command(
    state: State<'_, AppState>,
    request: CreateThreadRequest,
) -> Result<CreateThreadResponse, String> {
    let project_path = get_project_path_from_state(&state)?;

    let title = request.title.unwrap_or_else(|| "New Chat".to_string());
    let thread_id = create_thread(&project_path, &request.model_id, &request.provider)
        .map_err(|e| e.to_string())?;

    // Update title if custom one provided
    if title != "New Chat" {
        update_thread_title(&project_path, &thread_id, &title)
            .map_err(|e| e.to_string())?;
    }

    Ok(CreateThreadResponse { thread_id, title })
}

/// Update a thread's title.
#[tauri::command]
pub fn update_thread_command(
    state: State<'_, AppState>,
    request: UpdateThreadRequest,
) -> Result<(), String> {
    let project_path = get_project_path_from_state(&state)?;

    if let Some(title) = request.title {
        update_thread_title(&project_path, &request.thread_id, &title)
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Delete a thread and all its messages.
#[tauri::command]
pub fn delete_thread_command(
    state: State<'_, AppState>,
    thread_id: String,
) -> Result<(), String> {
    let project_path = get_project_path_from_state(&state)?;
    delete_thread(&project_path, &thread_id).map_err(|e| e.to_string())
}

// ============================================================================
// Message Commands
// ============================================================================

/// Get all messages for a thread.
#[tauri::command]
pub fn get_messages_command(
    state: State<'_, AppState>,
    thread_id: String,
) -> Result<Vec<crate::features::agent_new::MessageInfo>, String> {
    let project_path = get_project_path_from_state(&state)?;
    get_messages(&project_path, &thread_id).map_err(|e| e.to_string())
}

// ============================================================================
// Chat Commands (Non-streaming)
// ============================================================================

/// Send a chat message and get a response (non-streaming).
///
/// This is a simplified version that returns the complete response.
/// For streaming responses, use `chat_stream_command`.
#[tauri::command]
pub async fn chat_send_command(
    state: State<'_, AppState>,
    request: ChatRequest,
) -> Result<ChatResponse, String> {
    let project_path = get_project_path_from_state(&state)?;

    // Get or create thread
    let thread_id = if let Some(id) = request.thread_id {
        if !thread_exists(&project_path, &id).map_err(|e| e.to_string())? {
            // Create new thread if ID doesn't exist
            create_thread(&project_path, &request.model_id, &request.provider)
                .map_err(|e| e.to_string())?
        } else {
            id
        }
    } else {
        create_thread(&project_path, &request.model_id, &request.provider)
            .map_err(|e| e.to_string())?
    };

    // Create executor and run
    let executor = AgentExecutor::new(&project_path);
    let supports_streaming = request.supports_streaming.unwrap_or(false);

    let response = executor
        .execute(&thread_id, &request.content, &request.model_id, &request.provider, supports_streaming)
        .await
        .map_err(|e| e.to_string())?;

    Ok(ChatResponse {
        thread_id,
        message_id: response.message_id,
        content: response.content,
        model_id: response.model_id,
        provider: response.provider,
    })
}

// ============================================================================
// Chat Commands (Streaming)
// ============================================================================

/// Send a chat message with streaming response.
///
/// Tokens are emitted via Tauri events: `agent-stream-{thread_id}`.
/// The command returns immediately with the thread ID.
#[tauri::command]
pub async fn chat_stream_command(
    state: State<'_, AppState>,
    window: Window,
    request: ChatRequest,
) -> Result<String, String> {
    let project_path = get_project_path_from_state(&state)?;

    // Get or create thread
    let thread_id = if let Some(id) = request.thread_id {
        if !thread_exists(&project_path, &id).map_err(|e| e.to_string())? {
            create_thread(&project_path, &request.model_id, &request.provider)
                .map_err(|e| e.to_string())?
        } else {
            id
        }
    } else {
        create_thread(&project_path, &request.model_id, &request.provider)
            .map_err(|e| e.to_string())?
    };

    let event_name = format!("agent-stream-{}", thread_id);
    let thread_id_for_spawn = thread_id.clone();
    let content = request.content.clone();
    let model_id = request.model_id.clone();
    let provider = request.provider.clone();
    let supports_streaming = request.supports_streaming.unwrap_or(false);
    let project_path_clone = project_path.clone();

    // Spawn streaming task
    tokio::spawn(async move {
        let executor = AgentExecutor::new(&project_path_clone);

        // Note: User message is saved by executor.execute() - no need to save here
        eprintln!("[chat_stream] Starting execution for thread: {}", thread_id_for_spawn);

        // Execute with streaming (simplified - for full streaming need executor refactoring)
        match executor
            .execute(&thread_id_for_spawn, &content, &model_id, &provider, supports_streaming)
            .await
        {
            Ok(response) => {
                // Emit the full response as tokens
                let _ = window.emit(&event_name, StreamEvent::token(&response.content));

                // Emit tool calls if any
                for tool_call in &response.tool_calls {
                    let _ = window.emit(
                        &event_name,
                        StreamEvent::tool_call(
                            &tool_call.id,
                            &tool_call.name,
                            &tool_call.args,
                        ),
                    );

                    // Emit tool result if available
                    if let Some(ref result) = tool_call.result {
                        let _ = window.emit(
                            &event_name,
                            StreamEvent::tool_result(&tool_call.id, &tool_call.name, result),
                        );
                    }
                }

                let _ = window.emit(&event_name, StreamEvent::Complete);
            }
            Err(e) => {
                eprintln!("[chat_stream] Error occurred: {:?}", e);
                let error_msg = match e {
                    ExecutorError::Provider(ref pe) => format!("Provider error: {}", pe),
                    ExecutorError::Database(ref de) => format!("Database error: {}", de),
                    ExecutorError::Llm(ref le) => format!("LLM error: {}", le),
                    ExecutorError::Tool(ref te) => format!("Tool error: {}", te),
                    ExecutorError::InvalidConfig(ref ie) => format!("Config error: {}", ie),
                    ExecutorError::ThreadNotFound(ref tf) => format!("Thread not found: {}", tf),
                    ExecutorError::Other(ref oe) => format!("Error: {}", oe),
                };
                let _ = window.emit(&event_name, StreamEvent::error(error_msg));
            }
        }
    });

    Ok(thread_id)
}

// ============================================================================
// Provider Commands
// ============================================================================

/// Get list of available providers.
///
/// Returns providers that have API keys configured or are local providers.
#[tauri::command]
pub fn get_available_providers_command() -> Vec<String> {
    crate::features::agent_new::get_available_providers()
}

// Note: set_project_path and get_project_path commands removed.
// agent_new now uses AppState.current_project_path managed by project module.

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_thread_request_deserialization() {
        let json = r#"{"title":"My Thread","modelId":"gemini-2.5-flash","provider":"google"}"#;
        let req: CreateThreadRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.title, Some("My Thread".to_string()));
        assert_eq!(req.model_id, "gemini-2.5-flash");
        assert_eq!(req.provider, "google");
    }

    #[test]
    fn test_create_thread_request_without_title() {
        let json = r#"{"modelId":"gemini-2.5-flash","provider":"google"}"#;
        let req: CreateThreadRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.title, None);
        assert_eq!(req.model_id, "gemini-2.5-flash");
    }

    #[test]
    fn test_create_thread_response_serialization() {
        let resp = CreateThreadResponse {
            thread_id: "thread-123".to_string(),
            title: "My Thread".to_string(),
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"threadId\":\"thread-123\""));
        assert!(json.contains("\"title\":\"My Thread\""));
    }

    #[test]
    fn test_chat_request_deserialization() {
        let json = r#"{"threadId":"thread-123","content":"Hello","modelId":"gemini-2.5-flash","provider":"google","supportsStreaming":true}"#;
        let req: ChatRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.thread_id, Some("thread-123".to_string()));
        assert_eq!(req.content, "Hello");
        assert_eq!(req.supports_streaming, Some(true));
    }

    #[test]
    fn test_chat_request_minimal() {
        let json = r#"{"content":"Hello","modelId":"gemini-2.5-flash","provider":"google"}"#;
        let req: ChatRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.thread_id, None);
        assert_eq!(req.supports_streaming, None);
    }

    #[test]
    fn test_chat_response_serialization() {
        let resp = ChatResponse {
            thread_id: "thread-123".to_string(),
            message_id: "msg-456".to_string(),
            content: "Hello!".to_string(),
            model_id: "gemini-2.5-flash".to_string(),
            provider: "google".to_string(),
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"threadId\":\"thread-123\""));
        assert!(json.contains("\"messageId\":\"msg-456\""));
        assert!(json.contains("\"content\":\"Hello!\""));
    }

    #[test]
    fn test_update_thread_request_deserialization() {
        let json = r#"{"threadId":"thread-123","title":"New Title"}"#;
        let req: UpdateThreadRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.thread_id, "thread-123");
        assert_eq!(req.title, Some("New Title".to_string()));
    }

    #[test]
    fn test_update_thread_request_without_title() {
        let json = r#"{"threadId":"thread-123"}"#;
        let req: UpdateThreadRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.thread_id, "thread-123");
        assert_eq!(req.title, None);
    }

    // Note: AgentNewState tests removed - state now comes from AppState
}
