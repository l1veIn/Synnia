//! Agent engine for executing chat sessions.
//!
//! This module provides the core execution engine for AI agent conversations,
//! including streaming and non-streaming modes, tool calling, and message persistence.
//!
//! ## Architecture
//!
//! - [`AgentEngine`] - Main execution engine for chat sessions
//! - [`EngineConfig`] - Configuration options for the engine
//! - [`StreamEvent`] - Events emitted during streaming responses
//!
//! ## Flow
//!
//! 1. User sends a message via `chat_send_message`
//! 2. Engine loads session history from database
//! 3. Engine creates agent with appropriate provider/model
//! 4. Engine runs in streaming or sync mode
//! 5. Response is streamed/sent to frontend via Tauri events
//! 6. Messages are persisted to database

use crate::features::agent::providers::registry::ProviderClient;
use crate::features::agent::state::ChatSession;
use crate::features::agent::types::{
    AgentError, AgentResult, Message, MessageRole, ProviderType,
};
use rig_core::client::CompletionClient;
use rig_core::completion::{Chat, Message as RigMessage};
use tokio::sync::mpsc;

// ============================================================================
// Engine Configuration
// ============================================================================

/// Configuration options for the agent engine.
#[derive(Debug, Clone)]
pub struct EngineConfig {
    /// Maximum tokens for model output
    pub max_tokens: Option<u64>,
    /// Temperature for response generation (0.0 - 1.0)
    pub temperature: Option<f32>,
    /// System prompt / preamble
    pub preamble: Option<String>,
}

impl Default for EngineConfig {
    fn default() -> Self {
        Self {
            max_tokens: Some(4096),
            temperature: Some(0.7),
            preamble: Some(
                "You are a helpful AI assistant. Be concise and direct in your answers."
                    .to_string(),
            ),
        }
    }
}

// ============================================================================
// Stream Events
// ============================================================================

/// Events emitted during streaming responses.
///
/// These events are sent to the frontend via Tauri events
/// to provide real-time feedback during agent execution.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum StreamEvent {
    /// A text token was received
    Token { text: String },
    /// A tool call was initiated
    ToolCall { tool_name: String, args: String },
    /// A tool result was received
    ToolResult { tool_name: String, result: String },
    /// An error occurred
    Error { message: String },
    /// Stream is complete
    Complete,
}

impl StreamEvent {
    /// Create a token event.
    pub fn token(text: impl Into<String>) -> Self {
        Self::Token {
            text: text.into(),
        }
    }

    /// Create a tool call event.
    pub fn tool_call(tool_name: impl Into<String>, args: impl Into<String>) -> Self {
        Self::ToolCall {
            tool_name: tool_name.into(),
            args: args.into(),
        }
    }

    /// Create a tool result event.
    pub fn tool_result(tool_name: impl Into<String>, result: impl Into<String>) -> Self {
        Self::ToolResult {
            tool_name: tool_name.into(),
            result: result.into(),
        }
    }

    /// Create an error event.
    pub fn error(message: impl Into<String>) -> Self {
        Self::Error {
            message: message.into(),
        }
    }

    /// Check if this event signals completion.
    pub fn is_complete(&self) -> bool {
        matches!(self, Self::Complete)
    }
}

// ============================================================================
// Response Types
// ============================================================================

/// Result of an agent execution.
#[derive(Debug, Clone)]
pub struct AgentResponse {
    /// The unique message ID of the assistant's response
    pub message_id: String,
    /// The full response text
    pub content: String,
    /// Model used for generation
    pub model_id: String,
    /// Provider used
    pub provider: ProviderType,
    /// Whether this response involved tool calls
    pub tool_calls: Vec<ToolCallInfo>,
    /// Token usage (if available)
    pub usage: Option<TokenUsage>,
}

/// Information about a tool call made during generation.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ToolCallInfo {
    /// Unique ID for this tool call
    pub id: String,
    /// Name of the tool called
    pub tool_name: String,
    /// Arguments passed to the tool (JSON string)
    pub args_json: String,
    /// Result returned by the tool (JSON string)
    pub result_json: Option<String>,
}

/// Token usage information.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TokenUsage {
    /// Input tokens used
    pub prompt_tokens: u32,
    /// Output tokens generated
    pub completion_tokens: u32,
    /// Total tokens
    pub total_tokens: u32,
}

// ============================================================================
// Agent Engine
// ============================================================================

/// Core execution engine for AI agent conversations.
///
/// The [`AgentEngine`] handles:
/// - Creating and configuring agent instances from providers
/// - Executing prompts in streaming and non-streaming modes
/// - Managing tool calls during execution
/// - Persisting messages to the database
///
/// # Example
///
/// ```no_run
/// use crate::features::agent::engine::{AgentEngine, EngineConfig};
/// use crate::features::agent::state::ChatSession;
///
/// # async fn example() -> Result<(), Box<dyn std::error::Error>> {
/// let engine = AgentEngine::new(EngineConfig::default());
///
/// // Execute a non-streaming prompt
/// let response = engine.run_sync(
///     &session,
///     "Hello, how can you help me?",
/// ).await?;
///
/// println!("Response: {}", response.content);
/// # Ok(())
/// # }
/// ```
pub struct AgentEngine {
    /// Engine configuration
    config: EngineConfig,
}

impl AgentEngine {
    /// Create a new agent engine with the given configuration.
    pub fn new(config: EngineConfig) -> Self {
        Self { config }
    }

    /// Create an agent engine with default configuration.
    pub fn default() -> Self {
        Self::new(EngineConfig::default())
    }

    /// Execute a prompt in streaming mode.
    ///
    /// Returns a channel that emits stream events as they arrive.
    ///
    /// # Arguments
    ///
    /// * `session` - The chat session context
    /// * `user_message` - The user's message text
    ///
    /// # Returns
    ///
    /// A channel receiver that yields [`StreamEvent`] items
    pub async fn run_stream(
        &self,
        _session: &ChatSession,
        _user_message: &str,
    ) -> AgentResult<mpsc::Receiver<StreamEvent>> {
        // Streaming is not yet fully implemented for Phase 6
        // Will be completed in a future phase
        let (_tx, _rx) = mpsc::channel::<StreamEvent>(100);
        Err(AgentError::LlmError(
            "Streaming not yet implemented in Phase 6".to_string(),
        ))
    }

    /// Execute a prompt in non-streaming (synchronous) mode.
    ///
    /// This waits for the complete response before returning.
    ///
    /// # Arguments
    ///
    /// * `session` - The chat session context
    /// * `user_message` - The user's message text
    ///
    /// # Returns
    ///
    /// The complete [`AgentResponse`]
    pub async fn run_sync(&self, session: &ChatSession, user_message: &str) -> AgentResult<AgentResponse> {
        let provider_client = ProviderClient::from_settings(session.current_provider)?;

        // Build the prompt with history
        let rig_history = Self::convert_history_to_rig(&session.history)?;

        let response = match &provider_client {
            ProviderClient::Google(client) => {
                let builder = client
                    .inner()
                    .agent(&model_id_for_provider(&session.current_model, ProviderType::Google))
                    .preamble(&self.config.preamble.clone().unwrap_or_default());

                let builder = if let Some(max_tokens) = self.config.max_tokens {
                    builder.max_tokens(max_tokens)
                } else {
                    builder
                };

                let agent = builder.build();

                // Use chat method for non-streaming with history
                let result = agent.chat(user_message, rig_history).await.map_err(|e| {
                    AgentError::LlmError(format!("Google agent chat failed: {}", e))
                })?;

                AgentResponse {
                    message_id: uuid::Uuid::new_v4().to_string(),
                    content: result,
                    model_id: session.current_model.clone(),
                    provider: ProviderType::Google,
                    tool_calls: Vec::new(),
                    usage: None,
                }
            }
            ProviderClient::Zhipu(client) => {
                let builder = client
                    .inner()
                    .agent(&model_id_for_provider(&session.current_model, ProviderType::Zhipu))
                    .preamble(&self.config.preamble.clone().unwrap_or_default());

                let builder = if let Some(max_tokens) = self.config.max_tokens {
                    builder.max_tokens(max_tokens)
                } else {
                    builder
                };

                let agent = builder.build();

                // Use chat method for non-streaming with history
                let result = agent.chat(user_message, rig_history).await.map_err(|e| {
                    AgentError::LlmError(format!("Zhipu agent chat failed: {}", e))
                })?;

                AgentResponse {
                    message_id: uuid::Uuid::new_v4().to_string(),
                    content: result,
                    model_id: session.current_model.clone(),
                    provider: ProviderType::Zhipu,
                    tool_calls: Vec::new(),
                    usage: None,
                }
            }
        };

        Ok(response)
    }

    /// Convert our message history to Rig's message format.
    fn convert_history_to_rig(history: &[Message]) -> AgentResult<Vec<RigMessage>> {
        let mut rig_messages = Vec::new();

        for msg in history {
            let rig_msg = match msg.role {
                MessageRole::User => RigMessage::user(&msg.content),
                MessageRole::Assistant => RigMessage::assistant(&msg.content),
                MessageRole::System => {
                    // System messages are typically included in preamble
                    // For now, skip them in history
                    continue;
                }
                MessageRole::Tool => {
                    // Tool messages are handled differently in Rig
                    // For now, we'll skip them in the history
                    continue;
                }
            };
            rig_messages.push(rig_msg);
        }

        Ok(rig_messages)
    }
}

/// Get the model ID for a specific provider.
///
/// This handles mapping between internal model IDs and provider-specific model IDs.
fn model_id_for_provider(model_id: &str, _provider: ProviderType) -> String {
    // For now, just return the model ID as-is
    // In the future, we might need to map between different provider conventions
    model_id.to_string()
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::agent::types::ProviderType;

    #[test]
    fn test_engine_config_default() {
        let config = EngineConfig::default();
        assert_eq!(config.max_tokens, Some(4096));
        assert_eq!(config.temperature, Some(0.7));
        assert!(config.preamble.is_some());
    }

    #[test]
    fn test_stream_event_token() {
        let event = StreamEvent::token("Hello");
        assert!(matches!(event, StreamEvent::Token { .. }));
        assert!(!event.is_complete());

        if let StreamEvent::Token { text } = event {
            assert_eq!(text, "Hello");
        }
    }

    #[test]
    fn test_stream_event_tool_call() {
        let event = StreamEvent::tool_call("search", "{\"query\":\"test\"}");
        assert!(matches!(event, StreamEvent::ToolCall { .. }));

        if let StreamEvent::ToolCall { tool_name, args } = event {
            assert_eq!(tool_name, "search");
            assert_eq!(args, "{\"query\":\"test\"}");
        }
    }

    #[test]
    fn test_stream_event_tool_result() {
        let event = StreamEvent::tool_result("search", "results");
        assert!(matches!(event, StreamEvent::ToolResult { .. }));

        if let StreamEvent::ToolResult { tool_name, result } = event {
            assert_eq!(tool_name, "search");
            assert_eq!(result, "results");
        }
    }

    #[test]
    fn test_stream_event_error() {
        let event = StreamEvent::error("Something went wrong");
        assert!(matches!(event, StreamEvent::Error { .. }));
        assert!(!event.is_complete());

        if let StreamEvent::Error { message } = event {
            assert_eq!(message, "Something went wrong");
        }
    }

    #[test]
    fn test_stream_event_complete() {
        let event = StreamEvent::Complete;
        assert!(event.is_complete());
    }

    #[test]
    fn test_agent_engine_new() {
        let engine = AgentEngine::new(EngineConfig::default());
        // Just verify it can be created
        assert_eq!(engine.config.max_tokens, Some(4096));
    }

    #[test]
    fn test_agent_engine_default() {
        let engine = AgentEngine::default();
        assert_eq!(engine.config.max_tokens, Some(4096));
    }

    #[test]
    fn test_convert_history_empty() {
        let history = vec![];
        let rig_messages = AgentEngine::convert_history_to_rig(&history).unwrap();
        assert!(rig_messages.is_empty());
    }

    #[test]
    fn test_convert_history_single_message() {
        let history = vec![Message::user("Hello")];
        let rig_messages = AgentEngine::convert_history_to_rig(&history).unwrap();
        assert_eq!(rig_messages.len(), 1);
    }

    #[test]
    fn test_convert_history_multiple_messages() {
        let history = vec![
            Message::user("Question 1"),
            Message::assistant("Answer 1"),
            Message::user("Question 2"),
        ];
        let rig_messages = AgentEngine::convert_history_to_rig(&history).unwrap();
        // System messages are filtered out, but user/assistant remain
        assert_eq!(rig_messages.len(), 3);
    }

    #[test]
    fn test_convert_history_system_message_skipped() {
        let history = vec![
            Message::system("You are a helpful assistant"),
            Message::user("Hello"),
        ];
        let rig_messages = AgentEngine::convert_history_to_rig(&history).unwrap();
        // System messages are skipped
        assert_eq!(rig_messages.len(), 1);
    }

    #[test]
    fn test_convert_history_tool_message_skipped() {
        let mut msg = Message::assistant("Response");
        msg.role = MessageRole::Tool;
        let history = vec![msg];
        let rig_messages = AgentEngine::convert_history_to_rig(&history).unwrap();
        // Tool messages are skipped
        assert!(rig_messages.is_empty());
    }

    #[test]
    fn test_model_id_for_provider() {
        assert_eq!(
            model_id_for_provider("gemini-2.5-flash", ProviderType::Google),
            "gemini-2.5-flash"
        );
        assert_eq!(
            model_id_for_provider("glm-4.7", ProviderType::Zhipu),
            "glm-4.7"
        );
    }

    // Integration tests (marked as ignored since they require real API keys)

    #[tokio::test]
    #[ignore = "Requires real API key - run with: cargo test -- --ignored"]
    async fn test_gemini_real_api() {
        // This test requires a valid Google API key in the settings
        let session = ChatSession::new(
            "Test",
            "gemini-2.5-flash",
            ProviderType::Google,
            false,
        );
        let engine = AgentEngine::default();

        let result = engine.run_sync(&session, "Say 'Hello, world!'").await;
        assert!(result.is_ok());

        let response = result.unwrap();
        assert!(!response.content.is_empty());
        assert_eq!(response.provider, ProviderType::Google);
    }

    #[tokio::test]
    #[ignore = "Requires real API key - run with: cargo test -- --ignored"]
    async fn test_zhipu_real_api() {
        // This test requires a valid Zhipu API key in the settings
        // Uses native Zhipu provider from Serein-sz/rig fork
        let session = ChatSession::new("Test", "glm-4-flash", ProviderType::Zhipu, false);
        let engine = AgentEngine::default();

        let result = engine.run_sync(&session, "Say 'Hello, world!'").await;
        if let Err(ref e) = result {
            eprintln!("Zhipu API error: {:?}", e);
        }
        assert!(result.is_ok(), "Zhipu API test failed: {:?}", result.err());

        let response = result.unwrap();
        assert!(!response.content.is_empty());
        assert_eq!(response.provider, ProviderType::Zhipu);
    }

    #[tokio::test]
    async fn test_streaming_fallback() {
        // Test that streaming falls back gracefully when not implemented
        let session = ChatSession::new(
            "Test",
            "gemini-2.5-flash",
            ProviderType::Google,
            true,
        );
        let engine = AgentEngine::default();

        let result = engine.run_stream(&session, "Say 'Hello!").await;
        assert!(result.is_err());
        assert!(matches!(result, Err(AgentError::LlmError(_))));
    }
}
