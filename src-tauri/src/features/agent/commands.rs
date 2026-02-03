//! Tauri command handlers for the agent module.
//!
//! This module exposes the agent functionality to the frontend through Tauri commands.
//! It provides thread management, message persistence, and agent execution capabilities.

use crate::core::AppState;  // Use global AppState instead of custom state
use crate::features::agent::executor::{AgentExecutor, StreamEvent};
use crate::features::agent::storage::{
    create_thread, delete_thread, get_messages, get_thread, get_threads, save_message,
    thread_exists, update_thread_title, ThreadInfo,
};
use futures::StreamExt;
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
) -> Result<Vec<crate::features::agent::MessageInfo>, String> {
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
    use crate::features::agent::providers::{ProviderClient, ProviderType};
    use crate::features::agent::storage::MessageInfo;
    use crate::features::agent::tools::{
        GetNodesListTool, CreateNodeSmartTool, UpdateNodesTool, DeleteNodesTool,
        GetAssetsListTool, UpdateAssetsTool,
    };
    use rig_core::agent::MultiTurnStreamItem;
    use rig_core::client::CompletionClient;
    use rig_core::completion::Message as RigMessage;
    use rig_core::streaming::{StreamedAssistantContent, StreamingChat};

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
    let thread_id_clone = thread_id.clone();
    let content = request.content.clone();
    let model_id = request.model_id.clone();
    let provider = request.provider.clone();
    let project_path_clone = project_path.clone();

    // Spawn streaming task
    tokio::spawn(async move {
        eprintln!("[chat_stream] Starting streaming for thread: {}", thread_id_clone);

        // Load message history FIRST (before saving current message)
        let history = match get_messages(&project_path_clone, &thread_id_clone) {
            Ok(msgs) => msgs,
            Err(e) => {
                let _ = window.emit(&event_name, StreamEvent::error(format!("Failed to load history: {}", e)));
                return;
            }
        };

        // Save user message (WAL pattern - after loading history to avoid duplication)
        let user_message_id = uuid::Uuid::new_v4().to_string();
        let user_content_json = serde_json::json!({
            "id": user_message_id,
            "role": "user",
            "content": [{"type": "text", "text": content}],
            "createdAt": chrono::Utc::now().to_rfc3339(),
            "attachments": [],
            "metadata": {"custom": {}}
        }).to_string();

        if let Err(e) = save_message(
            &project_path_clone,
            &thread_id_clone,
            &user_message_id,
            "user",
            &user_content_json,
            None,
            None,
        ) {
            eprintln!("[chat_stream] Failed to save user message: {}", e);
            let _ = window.emit(&event_name, StreamEvent::error(format!("Database error: {}", e)));
            return;
        }

        // Convert history to Rig format
        let rig_history: Vec<RigMessage> = history
            .iter()
            .filter_map(|msg: &MessageInfo| {
                // Parse content_json to extract text
                let text = match serde_json::from_str::<serde_json::Value>(&msg.content_json) {
                    Ok(json) => {
                        if let Some(content_arr) = json.get("content").and_then(|c| c.as_array()) {
                            content_arr
                                .iter()
                                .filter_map(|part| {
                                    if part.get("type")?.as_str()? == "text" {
                                        part.get("text")?.as_str().map(|s| s.to_string())
                                    } else {
                                        None
                                    }
                                })
                                .collect::<Vec<_>>()
                                .join("")
                        } else {
                            String::new()
                        }
                    }
                    Err(_) => msg.content_json.clone(),
                };

                match msg.role.as_str() {
                    "user" => Some(RigMessage::user(&text)),
                    "assistant" => Some(RigMessage::assistant(&text)),
                    _ => None,
                }
            })
            .collect();

        // Create provider client dynamically based on provider parameter
        let provider_type = match ProviderType::parse(&provider) {
            Some(pt) => pt,
            None => {
                let _ = window.emit(&event_name, StreamEvent::error(format!("Unknown provider: {}", provider)));
                return;
            }
        };

        let provider_client = match ProviderClient::from_env(provider_type) {
            Ok(c) => c,
            Err(e) => {
                let _ = window.emit(&event_name, StreamEvent::error(format!("Provider error: {}", e)));
                return;
            }
        };

        // Create all tools for this agent
        let get_nodes = GetNodesListTool::new(&project_path_clone);
        let create_node = CreateNodeSmartTool::new(&project_path_clone);
        let update_nodes = UpdateNodesTool::new(&project_path_clone);
        let delete_nodes = DeleteNodesTool::new(&project_path_clone);
        let get_assets = GetAssetsListTool::new(&project_path_clone);
        let update_assets = UpdateAssetsTool::new(&project_path_clone);
        
        // Start streaming based on provider type
        let mut full_text = String::new();
        let mut tool_calls_json = Vec::<serde_json::Value>::new();
        let mut stream_error: Option<String> = None;

        match provider_client {
            ProviderClient::Google(client) => {
                let agent = client
                    .inner()
                    .agent(&model_id)
                    .preamble("You are a helpful AI assistant that can interact with the Synnia canvas.")
                    .default_max_depth(5)
                    .tool(get_nodes)
                    .tool(create_node)
                    .tool(update_nodes)
                    .tool(delete_nodes)
                    .tool(get_assets)
                    .tool(update_assets)
                    .build();

                let mut stream = agent.stream_chat(&content, rig_history).await;

                while let Some(chunk) = stream.next().await {
                    match chunk {
                        Ok(MultiTurnStreamItem::StreamAssistantItem(StreamedAssistantContent::Text(text))) => {
                            full_text.push_str(&text.text);
                            let _ = window.emit(&event_name, StreamEvent::token(&text.text));
                        }
                        Ok(MultiTurnStreamItem::StreamAssistantItem(StreamedAssistantContent::ToolCall(tool_call))) => {
                            let args_json = serde_json::to_string(&tool_call.function.arguments)
                                .unwrap_or_else(|_| "{}".to_string());
                            let tool_call_id = format!("tc_{}", uuid::Uuid::new_v4());
                            
                            tool_calls_json.push(serde_json::json!({
                                "type": "tool-call",
                                "toolCallId": tool_call_id,
                                "toolName": tool_call.function.name,
                                "args": tool_call.function.arguments
                            }));
                            
                            let _ = window.emit(&event_name, StreamEvent::tool_call(
                                &tool_call_id,
                                &tool_call.function.name,
                                &args_json,
                            ));
                        }
                        Ok(MultiTurnStreamItem::StreamUserItem(rig_core::streaming::StreamedUserContent::ToolResult(tool_result))) => {
                            let result_json = serde_json::to_string(&tool_result.content)
                                .unwrap_or_else(|_| "null".to_string());
                            let _ = window.emit(&event_name, StreamEvent::tool_result(
                                &tool_result.id,
                                "tool",
                                &result_json,
                            ));
                        }
                        Ok(MultiTurnStreamItem::FinalResponse(_)) => {
                            break;
                        }
                        Ok(_) => {}
                        Err(e) => {
                            eprintln!("[chat_stream] Stream error: {}", e);
                            stream_error = Some(e.to_string());
                            break;
                        }
                    }
                }
            }
            ProviderClient::Zhipu(client) => {
                // Create all tools for Zhipu branch (due to ownership)
                let get_nodes2 = GetNodesListTool::new(&project_path_clone);
                let create_node2 = CreateNodeSmartTool::new(&project_path_clone);
                let update_nodes2 = UpdateNodesTool::new(&project_path_clone);
                let delete_nodes2 = DeleteNodesTool::new(&project_path_clone);
                let get_assets2 = GetAssetsListTool::new(&project_path_clone);
                let update_assets2 = UpdateAssetsTool::new(&project_path_clone);
                let agent = client
                    .inner()
                    .agent(&model_id)
                    .preamble("You are a helpful AI assistant that can interact with the Synnia canvas.")
                    .default_max_depth(5)
                    .tool(get_nodes2)
                    .tool(create_node2)
                    .tool(update_nodes2)
                    .tool(delete_nodes2)
                    .tool(get_assets2)
                    .tool(update_assets2)
                    .build();

                let mut stream = agent.stream_chat(&content, rig_history).await;

                while let Some(chunk) = stream.next().await {
                    match chunk {
                        Ok(MultiTurnStreamItem::StreamAssistantItem(StreamedAssistantContent::Text(text))) => {
                            full_text.push_str(&text.text);
                            let _ = window.emit(&event_name, StreamEvent::token(&text.text));
                        }
                        Ok(MultiTurnStreamItem::StreamAssistantItem(StreamedAssistantContent::ToolCall(tool_call))) => {
                            let args_json = serde_json::to_string(&tool_call.function.arguments)
                                .unwrap_or_else(|_| "{}".to_string());
                            let tool_call_id = format!("tc_{}", uuid::Uuid::new_v4());
                            
                            tool_calls_json.push(serde_json::json!({
                                "type": "tool-call",
                                "toolCallId": tool_call_id,
                                "toolName": tool_call.function.name,
                                "args": tool_call.function.arguments
                            }));
                            
                            let _ = window.emit(&event_name, StreamEvent::tool_call(
                                &tool_call_id,
                                &tool_call.function.name,
                                &args_json,
                            ));
                        }
                        Ok(MultiTurnStreamItem::StreamUserItem(rig_core::streaming::StreamedUserContent::ToolResult(tool_result))) => {
                            let result_json = serde_json::to_string(&tool_result.content)
                                .unwrap_or_else(|_| "null".to_string());
                            let _ = window.emit(&event_name, StreamEvent::tool_result(
                                &tool_result.id,
                                "tool",
                                &result_json,
                            ));
                        }
                        Ok(MultiTurnStreamItem::FinalResponse(_)) => {
                            break;
                        }
                        Ok(_) => {}
                        Err(e) => {
                            eprintln!("[chat_stream] Stream error: {}", e);
                            stream_error = Some(e.to_string());
                            break;
                        }
                    }
                }
            }
            // OpenAI, Anthropic, DeepSeek not yet supported for streaming chat
            // They are available for execute_model_command (one-shot)
            _ => {
                let _ = window.emit(&event_name, StreamEvent::error(
                    format!("Provider {} not yet supported for streaming chat. Use execute_model_command instead.", provider)
                ));
                return;
            }
        }


        // Handle stream error
        if let Some(error_msg) = stream_error {
            let _ = window.emit(&event_name, StreamEvent::error(error_msg));
            return;
        }

        // Save assistant message
        let assistant_message_id = uuid::Uuid::new_v4().to_string();
        
        let mut content_parts: Vec<serde_json::Value> = vec![];
        if !full_text.is_empty() {
            content_parts.push(serde_json::json!({"type": "text", "text": full_text}));
        }
        content_parts.extend(tool_calls_json);
        
        let assistant_content_json = serde_json::json!({
            "id": assistant_message_id,
            "role": "assistant",
            "content": content_parts,
            "createdAt": chrono::Utc::now().to_rfc3339(),
            "status": {"type": "complete", "reason": "stop"},
            "metadata": {
                "custom": {},
                "steps": [],
                "unstable_annotations": [],
                "unstable_data": []
            }
        }).to_string();

        if let Err(e) = save_message(
            &project_path_clone,
            &thread_id_clone,
            &assistant_message_id,
            "assistant",
            &assistant_content_json,
            Some(&model_id),
            Some(&provider),
        ) {
            eprintln!("[chat_stream] Failed to save assistant message: {}", e);
        }

        let _ = window.emit(&event_name, StreamEvent::Complete);
        eprintln!("[chat_stream] Streaming complete for thread: {}", thread_id_clone);
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
    crate::features::agent::get_available_providers()
}

/// Get information about all supported providers.
///
/// Returns static list of all providers the system can support,
/// regardless of whether they are configured.
#[tauri::command]
pub fn get_all_providers_command() -> Vec<ProviderInfo> {
    use crate::features::agent::providers::ProviderType;
    
    ProviderType::all()
        .iter()
        .map(|p| p.info())
        .collect()
}

/// Provider information for frontend display.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderInfo {
    /// Unique key for the provider
    pub key: String,
    /// Human-readable name
    pub name: String,
    /// Short description
    pub description: String,
    /// Provider type: "cloud" or "local"
    pub provider_type: String,
    /// Placeholder text for API key input
    pub placeholder: String,
    /// Default base URL
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_base_url: Option<String>,
    /// Whether an API key is required
    pub requires_api_key: bool,
}

/// Input for execute_model_command.
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelExecuteRequest {
    /// Provider to use
    pub provider: String,
    /// Model ID
    pub model_id: String,
    /// Text prompt
    pub prompt: String,
    /// Optional system prompt
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_prompt: Option<String>,
}

/// Output from execute_model_command.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelExecuteResponse {
    /// Whether execution succeeded
    pub success: bool,
    /// Response text
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    /// Error message if failed
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Execute a model with a single prompt (non-streaming).
///
/// This is used for simple one-shot executions like recipe nodes.
#[tauri::command]
pub async fn execute_model_command(
    request: ModelExecuteRequest,
) -> Result<ModelExecuteResponse, String> {
    use crate::features::agent::providers::{ProviderClient, ProviderType};

    let provider_type = ProviderType::parse(&request.provider)
        .ok_or_else(|| format!("Unknown provider: {}", request.provider))?;

    let provider_client = ProviderClient::from_env(provider_type)
        .map_err(|e| format!("Provider error: {}", e))?;

    let result = provider_client
        .execute_prompt(
            &request.model_id,
            &request.prompt,
            request.system_prompt.as_deref(),
        )
        .await;

    match result {
        Ok(response) => Ok(ModelExecuteResponse {
            success: true,
            text: Some(response),
            error: None,
        }),
        Err(e) => Ok(ModelExecuteResponse {
            success: false,
            text: None,
            error: Some(e.to_string()),
        }),
    }
}



// Note: set_project_path and get_project_path commands removed.
// agent now uses AppState.current_project_path managed by project module.

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
