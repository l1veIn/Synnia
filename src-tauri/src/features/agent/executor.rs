//! Agent executor for running AI chat sessions.
//!
//! This module provides the core execution engine for AI agent conversations,
//! including streaming and non-streaming modes, tool calling, and message persistence.
//!
//! ## Architecture
//!
//! - [`StreamEvent`] - Events emitted during streaming responses
//! - [`StreamBuffer`] - Buffered streaming to avoid excessive emits
//! - [`AgentExecutor`] - Main execution engine for chat sessions
//!
//! ## Flow
//!
//! 1. User sends a message via Tauri command
//! 2. Executor loads thread history from database
//! 3. Executor creates agent with appropriate provider/model
//! 4. Executor runs in streaming or sync mode (with fallback)
//! 5. Response is streamed/sent to frontend via Tauri events
//! 6. Messages are persisted to database

use crate::features::agent::providers::{GeminiClient, ProviderType, ProviderError};
use crate::features::agent::storage::{get_connection, save_message, get_messages, MessageInfo};
use crate::features::agent::tools::GetNodesListTool;
use rig_core::client::CompletionClient;
use rig_core::completion::{Chat, Message as RigMessage};
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};

// ============================================================================
// Stream Events
// ============================================================================

/// Events emitted during streaming responses.
///
/// These events are sent to the frontend via Tauri events
/// to provide real-time feedback during agent execution.
///
/// SYNC: src/features/chat/types.ts
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum StreamEvent {
    /// A text token was received
    Token { text: String },
    /// A tool call was initiated
    ToolCall { id: String, name: String, args: String },
    /// A tool result was received
    ToolResult { id: String, name: String, result: String },
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
    pub fn tool_call(id: impl Into<String>, name: impl Into<String>, args: impl Into<String>) -> Self {
        Self::ToolCall {
            id: id.into(),
            name: name.into(),
            args: args.into(),
        }
    }

    /// Create a tool result event.
    pub fn tool_result(id: impl Into<String>, name: impl Into<String>, result: impl Into<String>) -> Self {
        Self::ToolResult {
            id: id.into(),
            name: name.into(),
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
// Stream Buffer
// ============================================================================

/// Streaming buffer to avoid emitting each token individually.
///
/// Buffers text chunks and flushes based on time or size thresholds
/// to reduce frontend event overhead.
pub struct StreamBuffer {
    buffer: String,
    last_flush: Instant,
    flush_interval: Duration,
    min_buffer_size: usize,
}

impl StreamBuffer {
    /// Create a new stream buffer with default settings.
    pub fn new() -> Self {
        Self {
            buffer: String::new(),
            last_flush: Instant::now(),
            flush_interval: Duration::from_millis(50),
            min_buffer_size: 100,
        }
    }

    /// Create a new stream buffer with custom settings.
    pub fn with_settings(flush_interval_ms: u64, min_buffer_size: usize) -> Self {
        Self {
            buffer: String::new(),
            last_flush: Instant::now(),
            flush_interval: Duration::from_millis(flush_interval_ms),
            min_buffer_size,
        }
    }

    /// Add text to the buffer.
    pub fn push(&mut self, text: &str) {
        self.buffer.push_str(text);
    }

    /// Check if the buffer should be flushed.
    pub fn should_flush(&self) -> bool {
        self.last_flush.elapsed() >= self.flush_interval || self.buffer.len() > self.min_buffer_size
    }

    /// Flush the buffer and return the contents.
    ///
    /// Returns `None` if the buffer is empty.
    pub fn flush(&mut self) -> Option<String> {
        if self.buffer.is_empty() {
            return None;
        }
        self.last_flush = Instant::now();
        Some(std::mem::take(&mut self.buffer))
    }

    /// Force flush regardless of buffer state.
    pub fn force_flush(&mut self) -> Option<String> {
        if self.buffer.is_empty() {
            return None;
        }
        self.last_flush = Instant::now();
        Some(std::mem::take(&mut self.buffer))
    }

    /// Get the current buffer size.
    pub fn len(&self) -> usize {
        self.buffer.len()
    }

    /// Check if the buffer is empty.
    pub fn is_empty(&self) -> bool {
        self.buffer.is_empty()
    }
}

impl Default for StreamBuffer {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Message JSON Builders (assistant-ui format)
// ============================================================================

/// Build a user message in assistant-ui format.
///
/// Example output:
/// ```json
/// {
///   "id": "msg_123",
///   "role": "user",
///   "content": [{"type": "text", "text": "Hello"}],
///   "createdAt": "2026-02-01T12:00:00Z",
///   "attachments": [],
///   "metadata": {"custom": {}}
/// }
/// ```
fn build_user_message_json(message_id: &str, text: &str) -> String {
    let now = chrono::Utc::now().to_rfc3339();
    serde_json::json!({
        "id": message_id,
        "role": "user",
        "content": [{"type": "text", "text": text}],
        "createdAt": now,
        "attachments": [],
        "metadata": {"custom": {}}
    }).to_string()
}

/// Build an assistant message in assistant-ui format.
///
/// Example output:
/// ```json
/// {
///   "id": "msg_456",
///   "role": "assistant",
///   "content": [{"type": "text", "text": "Hi there!"}],
///   "createdAt": "2026-02-01T12:00:01Z",
///   "status": {"type": "complete", "reason": "stop"},
///   "metadata": {"custom": {}, "steps": [], "unstable_annotations": [], "unstable_data": []}
/// }
/// ```
fn build_assistant_message_json(message_id: &str, text: &str) -> String {
    let now = chrono::Utc::now().to_rfc3339();
    serde_json::json!({
        "id": message_id,
        "role": "assistant",
        "content": [{"type": "text", "text": text}],
        "createdAt": now,
        "status": {"type": "complete", "reason": "stop"},
        "metadata": {
            "custom": {},
            "steps": [],
            "unstable_annotations": [],
            "unstable_data": []
        }
    }).to_string()
}

// ============================================================================
// Executor Error
// ============================================================================

/// Error type for executor operations.
#[derive(Debug, thiserror::Error)]
pub enum ExecutorError {
    /// Provider-related error
    #[error("Provider error: {0}")]
    Provider(#[from] ProviderError),

    /// Database error
    #[error("Database error: {0}")]
    Database(String),

    /// LLM API error
    #[error("LLM error: {0}")]
    Llm(String),

    /// Tool execution error
    #[error("Tool error: {0}")]
    Tool(String),

    /// Invalid configuration
    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),

    /// Thread not found
    #[error("Thread not found: {0}")]
    ThreadNotFound(String),

    /// Other error
    #[error("Executor error: {0}")]
    Other(String),
}

/// Result type for executor operations.
pub type ExecutorResult<T> = Result<T, ExecutorError>;

// ============================================================================
// Response Types
// ============================================================================

/// Result of an agent execution.
#[derive(Debug, Clone)]
pub struct ExecutorResponse {
    /// The unique message ID of the assistant's response
    pub message_id: String,
    /// The full response text
    pub content: String,
    /// Model used for generation
    pub model_id: String,
    /// Provider used
    pub provider: String,
    /// Whether this response involved tool calls
    pub tool_calls: Vec<ToolCallInfo>,
}

/// Information about a tool call made during generation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallInfo {
    /// Unique ID for this tool call
    pub id: String,
    /// Name of the tool called
    pub name: String,
    /// Arguments passed to the tool (JSON string)
    pub args: String,
    /// Result returned by the tool (JSON string)
    pub result: Option<String>,
}

// ============================================================================
// Agent Executor
// ============================================================================

/// Core execution engine for AI agent conversations.
///
/// The [`AgentExecutor`] handles:
/// - Creating and configuring agent instances from providers
/// - Executing prompts in streaming and non-streaming modes
/// - Managing tool calls during execution
/// - Persisting messages to the database
/// - Fallback from streaming to non-streaming when needed
pub struct AgentExecutor {
    /// Project path for database operations
    project_path: String,
    /// System prompt / preamble
    preamble: Option<String>,
    /// Maximum tokens for model output
    max_tokens: Option<u64>,
}

impl AgentExecutor {
    /// Create a new agent executor.
    pub fn new(project_path: impl Into<String>) -> Self {
        Self {
            project_path: project_path.into(),
            preamble: Some(
                "You are a helpful AI assistant. Be concise and direct in your answers."
                    .to_string(),
            ),
            max_tokens: Some(4096),
        }
    }

    /// Set the preamble for the agent.
    pub fn with_preamble(mut self, preamble: impl Into<String>) -> Self {
        self.preamble = Some(preamble.into());
        self
    }

    /// Set the maximum tokens for the agent.
    pub fn with_max_tokens(mut self, max_tokens: u64) -> Self {
        self.max_tokens = Some(max_tokens);
        self
    }

    /// Execute a chat message with automatic streaming fallback.
    ///
    /// This method checks if the model supports streaming and calls
    /// the appropriate execution method.
    ///
    /// # Arguments
    ///
    /// * `thread_id` - The thread/conversation ID
    /// * `user_message` - The user's message text
    /// * `model_id` - Model identifier (e.g., "gemini-2.5-flash")
    /// * `provider` - Provider name (e.g., "google")
    /// * `supports_streaming` - Whether the model supports streaming
    ///
    /// # Returns
    ///
    /// The complete [`ExecutorResponse`]
    pub async fn execute(
        &self,
        thread_id: &str,
        user_message: &str,
        model_id: &str,
        provider: &str,
        supports_streaming: bool,
    ) -> ExecutorResult<ExecutorResponse> {
        // Ensure thread exists
        if !self.thread_exists(thread_id)? {
            return Err(ExecutorError::ThreadNotFound(thread_id.to_string()));
        }

        // Save user message (WAL - Write Ahead Logging)
        let user_message_id = uuid::Uuid::new_v4().to_string();
        let user_content_json = build_user_message_json(&user_message_id, user_message);
        save_message(
            &self.project_path,
            thread_id,
            &user_message_id,
            "user",
            &user_content_json,
            None,  // User messages don't need model_id
            None,  // User messages don't need provider
        )
        .map_err(|e| ExecutorError::Database(e.to_string()))?;

        // Execute with streaming or non-streaming
        let response = if supports_streaming {
            self.execute_stream_internal(thread_id, user_message, model_id, provider)
                .await?
        } else {
            self.execute_sync_internal(thread_id, user_message, model_id, provider)
                .await?
        };

        // Save assistant message with model/provider info
        let assistant_content_json = build_assistant_message_json(&response.message_id, &response.content);
        save_message(
            &self.project_path,
            thread_id,
            &response.message_id,
            "assistant",
            &assistant_content_json,
            Some(model_id),
            Some(provider),
        )
        .map_err(|e| ExecutorError::Database(e.to_string()))?;

        Ok(response)
    }

    /// Execute with streaming (internal implementation).
    async fn execute_stream_internal(
        &self,
        thread_id: &str,
        user_message: &str,
        model_id: &str,
        provider: &str,
    ) -> ExecutorResult<ExecutorResponse> {
        let provider_type = ProviderType::parse(provider)
            .ok_or_else(|| ExecutorError::InvalidConfig(format!("Unknown provider: {}", provider)))?;

        // Load message history
        let history = self.load_history(thread_id)?;

        match provider_type {
            ProviderType::Google => {
                self.execute_gemini_stream(thread_id, user_message, model_id, &history)
                    .await
            }
            _ => Err(ExecutorError::Llm(format!(
                "Streaming not implemented for provider: {}",
                provider
            ))),
        }
    }

    /// Execute with Gemini streaming.
    async fn execute_gemini_stream(
        &self,
        _thread_id: &str,
        user_message: &str,
        model_id: &str,
        history: &[MessageInfo],
    ) -> ExecutorResult<ExecutorResponse> {
        let client = GeminiClient::from_env()?;
        let rig_history = self.convert_history_to_rig(history)?;

        let mut builder = client.inner().agent(model_id);

        if let Some(ref preamble) = self.preamble {
            builder = builder.preamble(preamble);
        }

        // Add tool if project path is available
        let tool = GetNodesListTool::new(&self.project_path);
        let agent = builder.tool(tool).build();

        // For now, use non-streaming API as fallback
        // Full streaming implementation would use agent.stream_chat()
        let content = agent
            .chat(user_message, rig_history)
            .await
            .map_err(|e| ExecutorError::Llm(format!("Gemini chat failed: {}", e)))?;

        Ok(ExecutorResponse {
            message_id: uuid::Uuid::new_v4().to_string(),
            content,
            model_id: model_id.to_string(),
            provider: "google".to_string(),
            tool_calls: Vec::new(),
        })
    }

    /// Execute without streaming (internal implementation).
    async fn execute_sync_internal(
        &self,
        thread_id: &str,
        user_message: &str,
        model_id: &str,
        provider: &str,
    ) -> ExecutorResult<ExecutorResponse> {
        let provider_type = ProviderType::parse(provider)
            .ok_or_else(|| ExecutorError::InvalidConfig(format!("Unknown provider: {}", provider)))?;

        // Load message history
        let history = self.load_history(thread_id)?;

        match provider_type {
            ProviderType::Google => {
                self.execute_gemini_sync(user_message, model_id, &history).await
            }
            _ => Err(ExecutorError::Llm(format!(
                "Provider not implemented: {}",
                provider
            ))),
        }
    }

    /// Execute with Gemini in non-streaming mode.
    async fn execute_gemini_sync(
        &self,
        user_message: &str,
        model_id: &str,
        history: &[MessageInfo],
    ) -> ExecutorResult<ExecutorResponse> {
        let client = GeminiClient::from_env()?;
        let rig_history = self.convert_history_to_rig(history)?;

        let mut builder = client.inner().agent(model_id);

        if let Some(ref preamble) = self.preamble {
            builder = builder.preamble(preamble);
        }

        // Add tool if project path is available
        let tool = GetNodesListTool::new(&self.project_path);
        let agent = builder.tool(tool).build();

        let content = agent
            .chat(user_message, rig_history)
            .await
            .map_err(|e| ExecutorError::Llm(format!("Gemini chat failed: {}", e)))?;

        Ok(ExecutorResponse {
            message_id: uuid::Uuid::new_v4().to_string(),
            content,
            model_id: model_id.to_string(),
            provider: "google".to_string(),
            tool_calls: Vec::new(),
        })
    }

    /// Load message history for a thread.
    fn load_history(&self, thread_id: &str) -> ExecutorResult<Vec<MessageInfo>> {
        get_messages(&self.project_path, thread_id)
            .map_err(|e| ExecutorError::Database(e.to_string()))
    }

    /// Convert our message history to Rig's message format.
    /// 
    /// Parses content_json to extract the text content for each message.
    fn convert_history_to_rig(&self, history: &[MessageInfo]) -> ExecutorResult<Vec<RigMessage>> {
        let mut rig_messages = Vec::new();

        for msg in history {
            // Parse content_json to extract text
            let content_text = match serde_json::from_str::<serde_json::Value>(&msg.content_json) {
                Ok(json) => {
                    // Extract text from content array: [{"type": "text", "text": "..."}]
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
                Err(_) => {
                    // Fallback: treat content_json as plain text (legacy support)
                    msg.content_json.clone()
                }
            };

            let rig_msg = match msg.role.as_str() {
                "user" => RigMessage::user(&content_text),
                "assistant" => RigMessage::assistant(&content_text),
                _ => {
                    // Skip system and tool messages for now
                    continue;
                }
            };
            rig_messages.push(rig_msg);
        }

        Ok(rig_messages)
    }

    /// Check if a thread exists.
    fn thread_exists(&self, thread_id: &str) -> ExecutorResult<bool> {
        use rusqlite::params;
        let conn = get_connection(&self.project_path)
            .map_err(|e| ExecutorError::Database(e.to_string()))?;

        let exists: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM agent_threads WHERE id = ?1)",
                params![thread_id],
                |row| row.get(0),
            )
            .unwrap_or(false);

        Ok(exists)
    }

    /// Get a reference to the project path.
    pub fn project_path(&self) -> &str {
        &self.project_path
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

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
        let event = StreamEvent::tool_call("call_1", "search", "{\"query\":\"test\"}");
        assert!(matches!(event, StreamEvent::ToolCall { .. }));

        if let StreamEvent::ToolCall { id, name, args } = event {
            assert_eq!(id, "call_1");
            assert_eq!(name, "search");
            assert_eq!(args, "{\"query\":\"test\"}");
        }
    }

    #[test]
    fn test_stream_event_tool_result() {
        let event = StreamEvent::tool_result("call_1", "search", "results");
        assert!(matches!(event, StreamEvent::ToolResult { .. }));

        if let StreamEvent::ToolResult { id, name, result } = event {
            assert_eq!(id, "call_1");
            assert_eq!(name, "search");
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
    fn test_stream_event_serialization() {
        let event = StreamEvent::token("Hello");
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"type\":\"token\""));
        assert!(json.contains("\"text\":\"Hello\""));

        let tool_event = StreamEvent::tool_call("id", "tool", "{}");
        let json = serde_json::to_string(&tool_event).unwrap();
        assert!(json.contains("\"type\":\"toolCall\""));
        assert!(json.contains("\"id\":\"id\""));

        let complete_event = StreamEvent::Complete;
        let json = serde_json::to_string(&complete_event).unwrap();
        assert_eq!(json, "{\"type\":\"complete\"}");
    }

    #[test]
    fn test_stream_buffer_new() {
        let buffer = StreamBuffer::new();
        assert!(buffer.is_empty());
        assert_eq!(buffer.len(), 0);
    }

    #[test]
    fn test_stream_buffer_push() {
        let mut buffer = StreamBuffer::new();
        buffer.push("Hello");
        buffer.push(" ");
        buffer.push("World");

        assert_eq!(buffer.len(), 11);
        assert!(!buffer.is_empty());
    }

    #[test]
    fn test_stream_buffer_should_flush_empty() {
        let buffer = StreamBuffer::new();
        // Empty buffer with no time elapsed should not flush
        assert!(!buffer.should_flush());
    }

    #[test]
    fn test_stream_buffer_should_flush_by_size() {
        let mut buffer = StreamBuffer::new();
        // Add enough text to exceed min_buffer_size
        buffer.push(&"a".repeat(200));
        assert!(buffer.should_flush());
    }

    #[test]
    fn test_stream_buffer_flush() {
        let mut buffer = StreamBuffer::new();
        buffer.push("Hello world");

        let flushed = buffer.flush();
        assert_eq!(flushed, Some("Hello world".to_string()));
        assert!(buffer.is_empty());
    }

    #[test]
    fn test_stream_buffer_flush_empty() {
        let mut buffer = StreamBuffer::new();
        let flushed = buffer.flush();
        assert!(flushed.is_none());
    }

    #[test]
    fn test_stream_buffer_force_flush() {
        let mut buffer = StreamBuffer::new();
        buffer.push("Hi");

        // Force flush even with small buffer
        let flushed = buffer.force_flush();
        assert_eq!(flushed, Some("Hi".to_string()));
        assert!(buffer.is_empty());
    }

    #[test]
    fn test_stream_buffer_with_settings() {
        let buffer = StreamBuffer::with_settings(100, 50);
        assert_eq!(buffer.min_buffer_size, 50);
        assert_eq!(buffer.flush_interval.as_millis(), 100);
    }

    #[test]
    fn test_stream_buffer_multiple_flushes() {
        let mut buffer = StreamBuffer::new();

        buffer.push("First");
        let flush1 = buffer.flush();
        assert_eq!(flush1, Some("First".to_string()));

        buffer.push("Second");
        let flush2 = buffer.flush();
        assert_eq!(flush2, Some("Second".to_string()));
    }

    #[test]
    fn test_executor_error_display() {
        let err = ExecutorError::Provider(ProviderError::ApiKeyMissing("google".to_string()));
        assert!(err.to_string().contains("Provider error"));

        let err = ExecutorError::Database("db error".to_string());
        assert_eq!(err.to_string(), "Database error: db error");

        let err = ExecutorError::ThreadNotFound("thread-1".to_string());
        assert_eq!(err.to_string(), "Thread not found: thread-1");
    }

    #[test]
    fn test_executor_new() {
        let executor = AgentExecutor::new("/test/path");
        assert_eq!(executor.project_path(), "/test/path");
        assert!(executor.preamble.is_some());
        assert_eq!(executor.max_tokens, Some(4096));
    }

    #[test]
    fn test_executor_with_preamble() {
        let executor = AgentExecutor::new("/test/path").with_preamble("Custom preamble");
        assert_eq!(executor.preamble, Some("Custom preamble".to_string()));
    }

    #[test]
    fn test_executor_with_max_tokens() {
        let executor = AgentExecutor::new("/test/path").with_max_tokens(2048);
        assert_eq!(executor.max_tokens, Some(2048));
    }

    #[test]
    fn test_convert_history_empty() {
        let executor = AgentExecutor::new("/test/path");
        let history: Vec<MessageInfo> = vec![];
        let rig_messages = executor.convert_history_to_rig(&history).unwrap();
        assert!(rig_messages.is_empty());
    }

    #[test]
    fn test_convert_history_single_user_message() {
        let executor = AgentExecutor::new("/test/path");
        let history = vec![MessageInfo {
            id: "msg1".to_string(),
            role: "user".to_string(),
            content_json: r#"{"content":[{"type":"text","text":"Hello"}]}"#.to_string(),
            model_id: None,
            provider: None,
            created_at: "2024-01-01T00:00:00Z".to_string(),
        }];
        let rig_messages = executor.convert_history_to_rig(&history).unwrap();
        assert_eq!(rig_messages.len(), 1);
    }

    #[test]
    fn test_convert_history_multiple_messages() {
        let executor = AgentExecutor::new("/test/path");
        let history = vec![
            MessageInfo {
                id: "msg1".to_string(),
                role: "user".to_string(),
                content_json: r#"{"content":[{"type":"text","text":"Question"}]}"#.to_string(),
                model_id: None,
                provider: None,
                created_at: "2024-01-01T00:00:00Z".to_string(),
            },
            MessageInfo {
                id: "msg2".to_string(),
                role: "assistant".to_string(),
                content_json: r#"{"content":[{"type":"text","text":"Answer"}]}"#.to_string(),
                model_id: Some("gemini-2.5-flash".to_string()),
                provider: Some("google".to_string()),
                created_at: "2024-01-01T00:00:01Z".to_string(),
            },
        ];
        let rig_messages = executor.convert_history_to_rig(&history).unwrap();
        assert_eq!(rig_messages.len(), 2);
    }

    #[test]
    fn test_convert_history_system_message_skipped() {
        let executor = AgentExecutor::new("/test/path");
        let history = vec![MessageInfo {
            id: "msg1".to_string(),
            role: "system".to_string(),
            content_json: r#"{"content":[{"type":"text","text":"System prompt"}]}"#.to_string(),
            model_id: None,
            provider: None,
            created_at: "2024-01-01T00:00:00Z".to_string(),
        }];
        let rig_messages = executor.convert_history_to_rig(&history).unwrap();
        // System messages are skipped
        assert!(rig_messages.is_empty());
    }

    #[test]
    fn test_convert_history_tool_message_skipped() {
        let executor = AgentExecutor::new("/test/path");
        let history = vec![MessageInfo {
            id: "msg1".to_string(),
            role: "tool".to_string(),
            content_json: r#"{"content":[{"type":"text","text":"Tool result"}]}"#.to_string(),
            model_id: None,
            provider: None,
            created_at: "2024-01-01T00:00:00Z".to_string(),
        }];
        let rig_messages = executor.convert_history_to_rig(&history).unwrap();
        // Tool messages are skipped
        assert!(rig_messages.is_empty());
    }

    #[test]
    fn test_tool_call_info_serialization() {
        let info = ToolCallInfo {
            id: "call_1".to_string(),
            name: "search".to_string(),
            args: "{\"query\":\"test\"}".to_string(),
            result: Some("results".to_string()),
        };

        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("\"id\":\"call_1\""));
        assert!(json.contains("\"name\":\"search\""));
    }

    #[tokio::test]
    async fn test_executor_thread_not_found() {
        let dir = tempfile::tempdir().unwrap();
        let project_path = dir.path().to_str().unwrap().to_string();
        let executor = AgentExecutor::new(&project_path);

        let result = executor
            .execute("nonexistent-thread", "Hello", "gemini-2.5-flash", "google", false)
            .await;

        assert!(matches!(result, Err(ExecutorError::ThreadNotFound(_))));
    }

    #[test]
    fn test_executor_response_clone() {
        let response = ExecutorResponse {
            message_id: "msg-1".to_string(),
            content: "Hello world".to_string(),
            model_id: "gemini-2.5-flash".to_string(),
            provider: "google".to_string(),
            tool_calls: vec![],
        };

        let response_clone = response.clone();
        assert_eq!(response.message_id, response_clone.message_id);
        assert_eq!(response.content, response_clone.content);
    }
}
