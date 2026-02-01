//! Tauri command handlers for the agent module.
//!
//! This module exposes the agent functionality to the frontend through Tauri commands.

use crate::features::agent::engine::AgentEngine;
use crate::features::agent::state::{AgentState, ChatSession};
use crate::features::agent::types::{Message, ProviderType};
use crate::global::database;
use tauri::{AppHandle, State, Emitter};
use futures::StreamExt;

use std::sync::{Arc, Mutex};

// ============================================================================
// Chat Commands
// ============================================================================

/// Response from sending a chat message.
#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendMessageResponse {
    /// The message ID of the assistant's response
    pub message_id: String,
    /// The full response content
    pub content: String,
    /// Model used for generation
    pub model_id: String,
    /// Provider used
    pub provider: ProviderType,
}

/// Send a message in a chat session (non-streaming).
#[tauri::command]
pub async fn chat_send_message(
    state: State<'_, Arc<Mutex<AgentState>>>,
    _app_handle: AppHandle,
    session_id: Option<String>,
    content: String,
    model_id: String,
    provider: String,
) -> Result<SendMessageResponse, String> {
    let provider_type = ProviderType::parse(&provider)
        .ok_or_else(|| format!("Invalid provider: '{}'", provider))?;

    let session_id = session_id.unwrap_or_else(|| {
        uuid::Uuid::new_v4().to_string()
    });

    // Check if session exists in runtime state
    let session_exists = {
        let agent_state = state.lock().map_err(|e| e.to_string())?;
        agent_state.get_session(&session_id).is_some()
    };

    let _session = if !session_exists {
        load_or_create_session(&session_id, &model_id, provider_type).await?
    } else {
        let agent_state = state.lock().map_err(|e| e.to_string())?;
        agent_state.get_session(&session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))?
    };

    // Update session model if needed
    {
        let agent_state = state.lock().map_err(|e| e.to_string())?;
        agent_state.switch_model(&session_id, &model_id, provider_type).ok();
    }

    // Create and save user message
    let user_message = Message::user(&content);
    {
        let conn = database::init_global_db().map_err(|e| e.to_string())?;
        crate::features::agent::storage::save_message(&conn, &session_id, &user_message)
            .map_err(|e| e.to_string())?;
    }

    {
        let agent_state = state.lock().map_err(|e| e.to_string())?;
        agent_state.add_message(&session_id, user_message.clone()).ok();
    }

    // Execute agent
    let engine = AgentEngine::default();
    let agent_session = {
        let agent_state = state.lock().map_err(|e| e.to_string())?;
        agent_state.get_session(&session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))?
    };

    let response = engine.run_sync(&agent_session, &content).await
        .map_err(|e| e.to_string())?;

    // Create and save assistant message
    let assistant_message = Message {
        id: response.message_id.clone(),
        role: crate::features::agent::types::MessageRole::Assistant,
        content: response.content.clone(),
        created_at: chrono::Utc::now().to_rfc3339(),
        model_id: Some(response.model_id.clone()),
        provider: Some(response.provider),
        tool_call_id: None,
        tool_name: None,
        tool_args_json: None,
        tool_result_json: None,
    };

    {
        let conn = database::init_global_db().map_err(|e| e.to_string())?;
        crate::features::agent::storage::save_message(&conn, &session_id, &assistant_message)
            .map_err(|e| e.to_string())?;
        crate::features::agent::storage::update_session_model(&conn, &session_id, &response.model_id, &response.provider.to_string())
            .map_err(|e| e.to_string())?;
    }

    {
        let agent_state = state.lock().map_err(|e| e.to_string())?;
        agent_state.add_message(&session_id, assistant_message).ok();
    }

    Ok(SendMessageResponse {
        message_id: response.message_id,
        content: response.content,
        model_id: response.model_id,
        provider: response.provider,
    })
}

/// Load a session from the database or create a new one.
async fn load_or_create_session(
    session_id: &str,
    model_id: &str,
    provider: ProviderType,
) -> Result<ChatSession, String> {
    let conn = database::init_global_db().map_err(|e| e.to_string())?;

    if let Some(session_info) = crate::features::agent::storage::get_session(&conn, session_id)
        .map_err(|e| e.to_string())?
    {
        let messages = crate::features::agent::storage::get_messages(&conn, session_id)
            .map_err(|e| e.to_string())?;

        Ok(ChatSession::with_history(
            session_id,
            session_info.title,
            messages,
            model_id,
            provider,
            true,
        ))
    } else {
        let title = "New Chat".to_string();
        crate::features::agent::storage::create_session(&conn, session_id, &title)
            .map_err(|e| e.to_string())?;

        Ok(ChatSession::new(title, model_id, provider, true))
    }
}

/// Send a message with streaming response.
/// Tokens are emitted via Tauri events "chat-stream-{session_id}".
#[tauri::command]
pub async fn chat_stream(
    app_state: State<'_, crate::core::AppState>,
    window: tauri::Window,
    session_id: Option<String>,
    content: String,
    model_id: String,
    provider: String,
) -> Result<String, String> {
    use crate::features::agent::engine::StreamEvent;
    use futures::StreamExt;
    
    let provider_type = ProviderType::parse(&provider)
        .ok_or_else(|| format!("Invalid provider: '{}'", provider))?;

    let session_id = session_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let event_name = format!("chat-stream-{}", session_id);

    // Get project path from AppState for tool execution
    let project_path = {
        let path_guard = app_state.current_project_path.lock()
            .map_err(|e| format!("Failed to lock project path: {}", e))?;
        path_guard.clone()
    };

    // TODO: Re-enable backend persistence after frontend migration
    // Currently using frontend JSON file persistence strategy
    
    // // Check if session exists
    // let session_exists = {
    //     let agent_state = state.lock().map_err(|e| e.to_string())?;
    //     agent_state.get_session(&session_id).is_some()
    // };

    // let _session = if !session_exists {
    //     load_or_create_session(&session_id, &model_id, provider_type).await?
    // } else {
    //     let agent_state = state.lock().map_err(|e| e.to_string())?;
    //     agent_state.get_session(&session_id)
    //         .ok_or_else(|| format!("Session not found: {}", session_id))?
    // };

    // // Update session model if needed
    // {
    //     let agent_state = state.lock().map_err(|e| e.to_string())?;
    //     agent_state.switch_model(&session_id, &model_id, provider_type).ok();
    // }

    // // Create and save user message
    // let user_message = Message::user(&content);
    // {
    //     let conn = database::init_global_db().map_err(|e| e.to_string())?;
    //     crate::features::agent::storage::save_message(&conn, &session_id, &user_message)
    //         .map_err(|e| e.to_string())?;
    // }
    // {
    //     let agent_state = state.lock().map_err(|e| e.to_string())?;
    //     agent_state.add_message(&session_id, user_message.clone()).ok();
    // }

    // // Get session with history for streaming
    // let agent_session = {
    //     let agent_state = state.lock().map_err(|e| e.to_string())?;
    //     agent_state.get_session(&session_id)
    //         .ok_or_else(|| format!("Session not found: {}", session_id))?
    // };

    // Create a temporary session for streaming with project path for tools
    let agent_session = ChatSession::new("Temp".to_string(), &model_id, provider_type, false)
        .with_project_path(project_path);

    // Spawn streaming task
    let window_clone = window.clone();
    let event_name_clone = event_name.clone();
    let _model_id_clone = model_id.clone();
    let _session_id_clone = session_id.clone();
    
    tokio::spawn(async move {
        match stream_chat_internal(&agent_session, &content).await {
            Ok(mut stream) => {
                use rig_core::agent::MultiTurnStreamItem;
                use rig_core::streaming::StreamedAssistantContent;
                
                let mut _full_text = String::new();
                
                while let Some(chunk) = stream.next().await {
                    match chunk {
                        Ok(MultiTurnStreamItem::StreamAssistantItem(StreamedAssistantContent::Text(text))) => {
                            _full_text.push_str(&text.text);
                            let _ = window_clone.emit(&event_name_clone, StreamEvent::token(&text.text));
                        }
                        Ok(MultiTurnStreamItem::StreamAssistantItem(StreamedAssistantContent::ToolCall(tool_call))) => {
                            // Emit tool call event for frontend Tool UI
                            let args_json = serde_json::to_string(&tool_call.function.arguments)
                                .unwrap_or_else(|_| "{}".to_string());
                            let _ = window_clone.emit(&event_name_clone, StreamEvent::tool_call(
                                &tool_call.function.name,
                                &args_json,
                            ));
                        }
                        Ok(MultiTurnStreamItem::StreamUserItem(rig_core::streaming::StreamedUserContent::ToolResult(tool_result))) => {
                            // Emit tool result event for frontend Tool UI
                            let result_json = serde_json::to_string(&tool_result.content)
                                .unwrap_or_else(|_| "null".to_string());
                            let _ = window_clone.emit(&event_name_clone, StreamEvent::tool_result(
                                &tool_result.id,
                                &result_json,
                            ));
                        }
                        Ok(MultiTurnStreamItem::FinalResponse(_)) => {
                            // Final response received, we're done
                            break;
                        }
                        Ok(_) => {
                            // Ignore other content types (reasoning, etc.)
                        }
                        Err(e) => {
                            let _ = window_clone.emit(&event_name_clone, StreamEvent::error(e.to_string()));
                            break;
                        }
                    }
                }
                
                // TODO: Re-enable backend persistence
                // // Save complete message
                // let message_id = uuid::Uuid::new_v4().to_string();
                // let assistant_message = Message {
                //     id: message_id.clone(),
                //     role: crate::features::agent::types::MessageRole::Assistant,
                //     content: full_text.clone(),
                //     created_at: chrono::Utc::now().to_rfc3339(),
                //     model_id: Some(model_id_clone.clone()),
                //     provider: Some(ProviderType::parse(&agent_session.current_provider.to_string()).unwrap_or(ProviderType::Google)),
                //     tool_call_id: None,
                //     tool_name: None,
                //     tool_args_json: None,
                //     tool_result_json: None,
                // };

                // if let Ok(conn) = database::init_global_db() {
                //     let _ = crate::features::agent::storage::save_message(&conn, &session_id_clone, &assistant_message);
                // }
                
                let _ = window_clone.emit(&event_name_clone, StreamEvent::Complete);
            }
            Err(e) => {
                let _ = window_clone.emit(&event_name_clone, StreamEvent::error(e.to_string()));
            }
        }
    });

    Ok(session_id)
}

/// Internal streaming chat implementation.
/// Returns a stream of MultiTurnStreamItem.
async fn stream_chat_internal(
    session: &ChatSession,
    user_message: &str,
) -> Result<rig_core::agent::StreamingResult<rig_core::providers::gemini::streaming::StreamingCompletionResponse>, String> {
    use crate::features::agent::providers::registry::ProviderClient;
    use crate::features::agent::tools::nodes::GetNodesListTool;
    use rig_core::streaming::StreamingChat;
    use rig_core::completion::Message as RigMessage;
    use rig_core::client::CompletionClient;
    
    let provider_client = ProviderClient::from_settings(session.current_provider)
        .map_err(|e| e.to_string())?;
    
    // Convert history
    let rig_history: Vec<RigMessage> = session.history.iter()
        .filter_map(|msg| {
            match msg.role {
                crate::features::agent::types::MessageRole::User => Some(RigMessage::user(&msg.content)),
                crate::features::agent::types::MessageRole::Assistant => Some(RigMessage::assistant(&msg.content)),
                _ => None,
            }
        })
        .collect();

    // Create tool if project path is available
    let nodes_tool = session.project_path.as_ref().map(|path| GetNodesListTool::new(path));
    
    match provider_client {
        ProviderClient::Google(client) => {
            let builder = client.inner()
                .agent(&session.current_model)
                .preamble("You are a helpful AI assistant. You have access to tools to query canvas nodes.");

            // Register tools if available
            if let Some(tool) = nodes_tool {
                let agent = builder.tool(tool).build();
                let stream = agent
                    .stream_chat(user_message, rig_history)
                    .await;
                Ok(stream)
            } else {
                let agent = builder.build();
                let stream = agent
                    .stream_chat(user_message, rig_history)
                    .await;
                Ok(stream)
            }
        }
        ProviderClient::Zhipu(_client) => {
            // Zhipu streaming needs different handling - fallback for now
            Err("Zhipu streaming not yet implemented".to_string())
        }
    }
}

/// Switch the model for an active chat session.
#[tauri::command]
pub fn chat_switch_model(
    state: State<'_, Arc<Mutex<AgentState>>>,
    session_id: String,
    model_id: String,
    provider: String,
) -> Result<(), String> {
    let provider_type = ProviderType::parse(&provider)
        .ok_or_else(|| format!("Invalid provider: '{}'", provider))?;

    let agent_state = state.lock().map_err(|e| e.to_string())?;
    agent_state
        .switch_model(&session_id, &model_id, provider_type)
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ============================================================================
// Session Commands
// ============================================================================

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSessionRequest {
    pub title: Option<String>,
    pub model_id: String,
    pub provider: String,
}

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSessionResponse {
    pub session_id: String,
    pub title: String,
}

#[tauri::command]
pub fn get_sessions(_app_handle: AppHandle) -> Result<Vec<crate::features::agent::types::SessionInfo>, String> {
    let conn = database::init_global_db().map_err(|e| e.to_string())?;
    crate::features::agent::storage::get_sessions(&conn)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_session_messages(
    _app_handle: AppHandle,
    session_id: String,
) -> Result<Vec<Message>, String> {
    let conn = database::init_global_db().map_err(|e| e.to_string())?;
    crate::features::agent::storage::get_messages(&conn, &session_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_session(
    state: State<'_, Arc<Mutex<AgentState>>>,
    _app_handle: AppHandle,
    request: CreateSessionRequest,
) -> Result<CreateSessionResponse, String> {
    let provider_type = ProviderType::parse(&request.provider)
        .ok_or_else(|| format!("Invalid provider: '{}'", request.provider))?;

    let session_id = uuid::Uuid::new_v4().to_string();
    let title = request.title.unwrap_or_else(|| "New Chat".to_string());

    let conn = database::init_global_db().map_err(|e| e.to_string())?;
    crate::features::agent::storage::create_session(&conn, &session_id, &title)
        .map_err(|e| e.to_string())?;
    crate::features::agent::storage::update_session_model(&conn, &session_id, &request.model_id, &request.provider)
        .map_err(|e| e.to_string())?;

    let session = ChatSession::new(&title, request.model_id, provider_type, true);
    let agent_state = state.lock().map_err(|e| e.to_string())?;
    agent_state.add_session(session);

    Ok(CreateSessionResponse { session_id, title })
}

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSessionRequest {
    pub session_id: String,
    pub title: Option<String>,
}

#[tauri::command]
pub fn update_session(
    _app_handle: AppHandle,
    request: UpdateSessionRequest,
) -> Result<(), String> {
    let conn = database::init_global_db().map_err(|e| e.to_string())?;
    if let Some(title) = request.title {
        crate::features::agent::storage::update_session_title(&conn, &request.session_id, &title)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn delete_session(
    state: State<'_, Arc<Mutex<AgentState>>>,
    _app_handle: AppHandle,
    session_id: String,
) -> Result<(), String> {
    let conn = database::init_global_db().map_err(|e| e.to_string())?;
    crate::features::agent::storage::delete_session(&conn, &session_id)
        .map_err(|e| e.to_string())?;

    let agent_state = state.lock().map_err(|e| e.to_string())?;
    agent_state.remove_session(&session_id);
    Ok(())
}

#[tauri::command]
pub fn get_session(
    _app_handle: AppHandle,
    session_id: String,
) -> Result<Option<crate::features::agent::types::SessionInfo>, String> {
    let conn = database::init_global_db().map_err(|e| e.to_string())?;
    crate::features::agent::storage::get_session(&conn, &session_id)
        .map_err(|e| e.to_string())
}

// ============================================================================
// Model Commands
// ============================================================================

#[tauri::command]
pub fn get_models(
    category: Option<String>,
    capabilities: Option<Vec<String>>,
    configured_only: Option<bool>,
) -> Result<Vec<crate::features::agent::types::ModelInfo>, String> {
    use crate::features::agent::types::{ModelCapability, ModelCategory};
    use crate::features::agent::providers::ModelRegistry;

    let cat = match category.as_deref() {
        Some("llm") => Some(ModelCategory::Llm),
        Some("image-generation") => Some(ModelCategory::ImageGeneration),
        Some("video-generation") => Some(ModelCategory::VideoGeneration),
        Some(other) => {
            return Err(format!("Unknown category: '{}'", other))
        }
        None => None,
    };

    let caps = match capabilities {
        Some(cap_strings) => {
            let parsed: Option<Vec<ModelCapability>> = cap_strings
                .iter()
                .map(|s| match s.as_str() {
                    "chat" => Some(ModelCapability::Chat),
                    "vision" => Some(ModelCapability::Vision),
                    "json-mode" => Some(ModelCapability::JsonMode),
                    "function-calling" => Some(ModelCapability::FunctionCalling),
                    "streaming" => Some(ModelCapability::Streaming),
                    _ => None,
                })
                .collect();

            match parsed {
                Some(caps) => Some(caps),
                None => return Ok(vec![]),
            }
        }
        None => None,
    };

    Ok(ModelRegistry::get_models(cat, caps, configured_only.unwrap_or(false)))
}

#[tauri::command]
pub fn get_model(id: String) -> Result<crate::features::agent::types::ModelInfo, String> {
    use crate::features::agent::providers::ModelRegistry;
    ModelRegistry::get_model(&id)
        .ok_or_else(|| format!("Model not found: '{}'", id))
}

// ============================================================================
// Unified Execution Commands
// ============================================================================

use crate::features::agent::providers::{google, zhipu};
use crate::features::agent::types::{ModelInput, ModelOutput, AiConfig, ProviderInfo};

/// Get information about all supported providers.
///
/// This is the single source of truth for which providers Synnia supports.
#[tauri::command]
pub fn get_all_providers() -> Vec<ProviderInfo> {
    ProviderType::all_info()
}

/// Get list of providers that have API keys configured.
///
/// Returns only providers that can be used (have valid API keys).
#[tauri::command]
pub async fn get_available_providers() -> Result<Vec<ProviderType>, String> {
    let conn = database::init_global_db().map_err(|e| e.to_string())?;
    
    let ai_config_json: Option<String> = crate::global::settings::get_setting(&conn, "app_settings")
        .map_err(|e| e.to_string())?;
    
    let config = ai_config_json
        .and_then(|json| serde_json::from_str::<AiConfig>(&json).ok())
        .unwrap_or_default();
    
    let mut available = Vec::new();
    
    for provider in ProviderType::all() {
        let provider_key = match provider {
            ProviderType::Google => "google",
            ProviderType::Zhipu => "zhipu",
        };
        
        if let Some(key) = config.get_api_key(provider_key) {
            if !key.is_empty() {
                available.push(*provider);
            }
        }
    }
    
    Ok(available)
}

/// Execute a model with unified input/output interface.
///
/// Routes to appropriate provider based on the provider type.
#[tauri::command]
pub async fn execute_model(
    provider: ProviderType,
    model_id: String,
    input: ModelInput,
) -> Result<ModelOutput, String> {
    let result = match provider {
        ProviderType::Google => google::execute(&model_id, input).await,
        ProviderType::Zhipu => zhipu::execute(&model_id, input).await,
    };
    
    result.map_err(|e| e.to_string())
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::agent::types::ProviderType;

    #[test]
    fn test_send_message_response_serialization() {
        let response = SendMessageResponse {
            message_id: "msg-123".to_string(),
            content: "Hello, world!".to_string(),
            model_id: "gemini-2.5-flash".to_string(),
            provider: ProviderType::Google,
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("messageId"));
    }

    #[test]
    fn test_parse_provider_valid() {
        assert_eq!(ProviderType::parse("google"), Some(ProviderType::Google));
        assert_eq!(ProviderType::parse("zhipu"), Some(ProviderType::Zhipu));
    }

    #[test]
    fn test_parse_provider_invalid() {
        assert_eq!(ProviderType::parse("invalid"), None);
    }
}
