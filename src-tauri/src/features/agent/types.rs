//! Agent module types.
//!
//! Core type definitions for the AI agent system, including:
//! - Model categories and capabilities
//! - Provider types
//! - Error handling

use serde::{Deserialize, Serialize};
use std::fmt;
use thiserror::Error;
use ts_rs::TS;

// ============================================================================
// Model Category & Capability Types
// ============================================================================

/// Broad domain categories for AI models.
///
/// These are NOT capability-based splits, but represent the primary function
/// of the model in the system.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ModelCategory {
    /// All language models (chat, vision, code)
    Llm,
    /// Text/image to image generation
    ImageGeneration,
    /// Text/image to video generation
    VideoGeneration,
}

impl fmt::Display for ModelCategory {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Llm => write!(f, "llm"),
            Self::ImageGeneration => write!(f, "image-generation"),
            Self::VideoGeneration => write!(f, "video-generation"),
        }
    }
}

/// Fine-grained capabilities for filtering models.
///
/// Models may have multiple capabilities. These are used to determine
/// which models can handle specific types of requests.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ModelCapability {
    /// Basic text conversation
    Chat,
    /// Can process images (vision)
    Vision,
    /// Structured JSON output mode
    JsonMode,
    /// Function/tool calling support
    FunctionCalling,
    /// Stream response support
    Streaming,
}

impl fmt::Display for ModelCapability {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Chat => write!(f, "chat"),
            Self::Vision => write!(f, "vision"),
            Self::JsonMode => write!(f, "json-mode"),
            Self::FunctionCalling => write!(f, "function-calling"),
            Self::Streaming => write!(f, "streaming"),
        }
    }
}

// ============================================================================
// Provider Types
// ============================================================================

/// Available AI providers.
///
/// Only Google and Zhipu are implemented in Phase 1.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProviderType {
    Google,
    Zhipu,
}

impl fmt::Display for ProviderType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Google => write!(f, "google"),
            Self::Zhipu => write!(f, "zhipu"),
        }
    }
}

impl ProviderType {
    /// Parse a string into a ProviderType.
    pub fn parse(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "google" => Some(Self::Google),
            "zhipu" => Some(Self::Zhipu),
            _ => None,
        }
    }

    /// Get all available providers.
    pub fn all() -> &'static [ProviderType] {
        &[ProviderType::Google, ProviderType::Zhipu]
    }
    
    /// Get detailed information about this provider.
    pub fn info(&self) -> ProviderInfo {
        match self {
            Self::Google => ProviderInfo {
                key: "google".to_string(),
                name: "Google AI".to_string(),
                description: "Gemini 2.0/2.5/3.0, Imagen".to_string(),
                provider_type: "cloud".to_string(),
                placeholder: "AIza...".to_string(),
                default_base_url: Some("https://generativelanguage.googleapis.com/v1beta".to_string()),
                requires_api_key: true,
            },
            Self::Zhipu => ProviderInfo {
                key: "zhipu".to_string(),
                name: "Zhipu AI".to_string(),
                description: "GLM-4.7, GLM-4.6v, CogView".to_string(),
                provider_type: "cloud".to_string(),
                placeholder: "your-zhipu-api-key".to_string(),
                default_base_url: Some("https://open.bigmodel.cn/api/paas/v4".to_string()),
                requires_api_key: true,
            },
        }
    }
    
    /// Get info for all providers.
    pub fn all_info() -> Vec<ProviderInfo> {
        Self::all().iter().map(|p| p.info()).collect()
    }
}

/// Detailed information about a provider.
///
/// This struct contains all metadata needed for UI display and configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderInfo {
    /// Unique key for the provider (e.g., "google", "zhipu")
    pub key: String,
    
    /// Human-readable name
    pub name: String,
    
    /// Short description of available models
    pub description: String,
    
    /// Provider type: "cloud" or "local"
    pub provider_type: String,
    
    /// Placeholder text for API key input
    pub placeholder: String,
    
    /// Default base URL for the provider
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_base_url: Option<String>,
    
    /// Whether an API key is required
    pub requires_api_key: bool,
}

/// Information about a specific model.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    /// Unique model identifier (e.g., "gemini-2.5-flash")
    pub id: String,

    /// Human-readable model name
    pub name: String,

    /// Provider that offers this model
    pub provider: ProviderType,

    /// Model category
    pub category: ModelCategory,

    /// Capabilities supported by this model
    #[serde(skip_serializing_if = "Option::is_none")]
    pub capabilities: Option<Vec<ModelCapability>>,

    /// Context window size in tokens (for LLMs)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_window: Option<usize>,

    /// Maximum output tokens
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_output_tokens: Option<usize>,

    /// Default temperature setting
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_temperature: Option<f32>,

    /// Whether the model requires an API key (always true for cloud providers)
    pub requires_api_key: bool,
}

/// Message role in a chat session.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    System,
    User,
    Assistant,
    Tool,
}

impl fmt::Display for MessageRole {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::System => write!(f, "system"),
            Self::User => write!(f, "user"),
            Self::Assistant => write!(f, "assistant"),
            Self::Tool => write!(f, "tool"),
        }
    }
}

/// A single message in a chat session.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Message {
    /// Unique message ID
    pub id: String,

    /// Message role
    pub role: MessageRole,

    /// Message content (text or structured data)
    pub content: String,

    /// Creation timestamp (RFC3339)
    pub created_at: String,

    /// Model that generated this message (for assistant messages)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_id: Option<String>,

    /// Provider used (for assistant messages)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<ProviderType>,

    /// Tool call ID (for tool messages)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,

    /// Tool name (for tool messages)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_name: Option<String>,

    /// Tool arguments as JSON (for assistant messages with tool calls)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_args_json: Option<String>,

    /// Tool result as JSON (for tool messages)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_result_json: Option<String>,
}

impl Message {
    /// Create a new user message.
    pub fn user(content: impl Into<String>) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            role: MessageRole::User,
            content: content.into(),
            created_at: chrono::Utc::now().to_rfc3339(),
            model_id: None,
            provider: None,
            tool_call_id: None,
            tool_name: None,
            tool_args_json: None,
            tool_result_json: None,
        }
    }

    /// Create a new assistant message.
    pub fn assistant(content: impl Into<String>) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            role: MessageRole::Assistant,
            content: content.into(),
            created_at: chrono::Utc::now().to_rfc3339(),
            model_id: None,
            provider: None,
            tool_call_id: None,
            tool_name: None,
            tool_args_json: None,
            tool_result_json: None,
        }
    }

    /// Create a new system message.
    pub fn system(content: impl Into<String>) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            role: MessageRole::System,
            content: content.into(),
            created_at: chrono::Utc::now().to_rfc3339(),
            model_id: None,
            provider: None,
            tool_call_id: None,
            tool_name: None,
            tool_args_json: None,
            tool_result_json: None,
        }
    }
}

/// Session metadata for listing.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
    pub message_count: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<ProviderType>,
}

// ============================================================================
// Error Types
// ============================================================================

/// Agent-specific error type.
///
/// Provides detailed error information for all agent operations.
#[derive(Debug, Error)]
pub enum AgentError {
    /// Provider not configured or not found
    #[error("Provider not configured: {0}")]
    ProviderNotConfigured(String),

    /// API key missing for provider
    #[error("API key missing for: {0}")]
    ApiKeyMissing(String),

    /// Model not found
    #[error("Model not found: {0}")]
    ModelNotFound(String),

    /// LLM API error
    #[error("LLM error: {0}")]
    LlmError(String),

    /// Database operation error
    #[error("Database error: {0}")]
    DatabaseError(String),

    /// I/O error
    #[error("IO error: {0}")]
    IoError(String),

    /// Serialization/deserialization error
    #[error("Serialization error: {0}")]
    SerializationError(String),

    /// Validation error
    #[error("Validation error: {0}")]
    Validation(String),

    /// Unsupported provider
    #[error("Unsupported provider: {0}")]
    UnsupportedProvider(String),

    /// Tool execution error
    #[error("Tool error: {0}")]
    ToolError(String),

    /// Session not found
    #[error("Session not found: {0}")]
    SessionNotFound(String),
}

/// Result type alias using AgentError.
pub type AgentResult<T> = Result<T, AgentError>;

// ============================================
// Automatic conversions
// ============================================

impl From<std::io::Error> for AgentError {
    fn from(err: std::io::Error) -> Self {
        AgentError::IoError(err.to_string())
    }
}

impl From<serde_json::Error> for AgentError {
    fn from(err: serde_json::Error) -> Self {
        AgentError::SerializationError(err.to_string())
    }
}

impl From<rusqlite::Error> for AgentError {
    fn from(err: rusqlite::Error) -> Self {
        AgentError::DatabaseError(err.to_string())
    }
}

// Convert AppError to AgentError for interop with settings module
impl From<crate::core::AppError> for AgentError {
    fn from(err: crate::core::AppError) -> Self {
        match err {
            crate::core::AppError::Io(msg) => AgentError::IoError(msg),
            crate::core::AppError::Database(msg) => AgentError::DatabaseError(msg),
            crate::core::AppError::Serialization(msg) => AgentError::SerializationError(msg),
            crate::core::AppError::Validation(msg) => AgentError::Validation(msg),
            crate::core::AppError::Agent(msg) => AgentError::LlmError(msg),
            _ => AgentError::LlmError(err.to_string()),
        }
    }
}

// ============================================================================
// AI Config Types (for reading from settings)
// ============================================================================

/// AI configuration stored in GlobalConfig.ai_config.
///
/// This structure mirrors the JSON format used by the frontend.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AiConfig {
    /// Provider configurations keyed by provider name
    #[serde(skip_serializing_if = "Option::is_none")]
    pub providers: Option<std::collections::HashMap<String, ProviderCredentials>>,
}

/// Credentials for a single provider.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProviderCredentials {
    /// API key for the provider
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,

    /// Base URL (for providers with custom endpoints)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
}

impl AiConfig {
    /// Parse AI config from JSON string.
    pub fn from_json(json: Option<&String>) -> AgentResult<Self> {
        match json {
            Some(s) if !s.is_empty() => {
                serde_json::from_str(s).map_err(AgentError::from)
            }
            _ => Ok(Self::default()),
        }
    }

    /// Get API key for a provider.
    pub fn get_api_key(&self, provider: &str) -> Option<String> {
        self.providers
            .as_ref()?
            .get(provider)?
            .api_key
            .clone()
    }

    /// Get base URL for a provider.
    pub fn get_base_url(&self, provider: &str) -> Option<String> {
        self.providers
            .as_ref()?
            .get(provider)?
            .base_url
            .clone()
    }
}

// ============================================================================
// Unified Model Execution Types
// ============================================================================

/// Input for unified model execution.
///
/// This struct represents the input to any model (LLM, image generation, etc).
/// Fields are optional because different model types use different inputs.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelInput {
    /// Text prompt for the model
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prompt: Option<String>,

    /// Chat messages for LLM
    #[serde(skip_serializing_if = "Option::is_none")]
    pub messages: Option<Vec<Message>>,

    /// Input images (base64 data URLs)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub images: Option<Vec<String>>,

    /// Model-specific configuration (temperature, aspect_ratio, etc.)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config: Option<serde_json::Value>,

    /// Model category hint (llm, image-generation, video-generation)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<ModelCategory>,
}

impl Default for ModelInput {
    fn default() -> Self {
        Self {
            prompt: None,
            messages: None,
            images: None,
            config: None,
            category: None,
        }
    }
}

/// Output from unified model execution.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelOutput {
    /// Whether execution succeeded
    pub success: bool,

    /// Error message if failed
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,

    /// Text output (for LLM responses)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,

    /// Generated images
    #[serde(skip_serializing_if = "Option::is_none")]
    pub images: Option<Vec<ImageOutput>>,

    /// Generated video URL
    #[serde(skip_serializing_if = "Option::is_none")]
    pub video_url: Option<String>,
}

impl ModelOutput {
    /// Create a successful text response
    pub fn text(content: String) -> Self {
        Self {
            success: true,
            error: None,
            text: Some(content),
            images: None,
            video_url: None,
        }
    }

    /// Create a successful image response
    pub fn images(images: Vec<ImageOutput>) -> Self {
        Self {
            success: true,
            error: None,
            text: None,
            images: Some(images),
            video_url: None,
        }
    }

    /// Create an error response
    pub fn error(message: String) -> Self {
        Self {
            success: false,
            error: Some(message),
            text: None,
            images: None,
            video_url: None,
        }
    }
}

/// Image output from generation models.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageOutput {
    /// Image URL or data URL
    pub url: String,

    /// Image width in pixels
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<u32>,

    /// Image height in pixels
    #[serde(skip_serializing_if = "Option::is_none")]
    pub height: Option<u32>,
}
