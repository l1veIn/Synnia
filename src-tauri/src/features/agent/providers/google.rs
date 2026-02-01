//! Google Gemini provider implementation.
//!
//! This module provides a wrapper around rig-core's gemini client
//! with initialization from the application settings.

use rig_core::providers::gemini;

use crate::features::agent::types::{AgentError, AgentResult, AiConfig};
use crate::global::database;
use crate::global::settings;

/// Wrapper for Google Gemini client.
pub struct GeminiClient {
    /// The underlying rig-core Gemini client
    client: gemini::Client,
}

impl GeminiClient {
    /// Base URL for Google Gemini API.
    #[allow(dead_code)]
    const DEFAULT_BASE_URL: &str = "https://generativelanguage.googleapis.com";

    /// Create a new Gemini client from an API key.
    pub fn new(api_key: String) -> AgentResult<Self> {
        if api_key.is_empty() {
            return Err(AgentError::ApiKeyMissing("google".to_string()));
        }

        let client = gemini::Client::new(&api_key)
            .map_err(|e| AgentError::LlmError(format!("Failed to create Gemini client: {}", e)))?;

        Ok(Self { client })
    }

    /// Create a new Gemini client from global settings.
    ///
    /// Reads the API key from the global database's app_settings.
    pub fn from_settings() -> AgentResult<Self> {
        let conn = database::init_global_db()?;
        // Note: The key is "app_settings", not "ai_config"
        let ai_config_json: Option<String> = settings::get_setting(&conn, "app_settings")?;

        let api_key = ai_config_json
            .and_then(|json| {
                let config: AiConfig = serde_json::from_str(&json).ok()?;
                config.get_api_key("google")
            })
            .ok_or_else(|| AgentError::ApiKeyMissing("google".to_string()))?;

        Self::new(api_key)
    }

    /// Get a reference to the underlying gemini client.
    pub fn inner(&self) -> &gemini::Client {
        &self.client
    }

    /// Consume and return the underlying gemini client.
    pub fn into_inner(self) -> gemini::Client {
        self.client
    }
}

// ============================================================================
// Unified Execute Interface
// ============================================================================

use rig_core::client::CompletionClient;
use rig_core::completion::Chat;
use crate::features::agent::types::{ModelInput, ModelOutput, ModelCategory};

/// Execute a model with the given input.
///
/// Routes to appropriate execution function based on model category.
pub async fn execute(model_id: &str, input: ModelInput) -> AgentResult<ModelOutput> {
    let client = GeminiClient::from_settings()?;
    
    // Determine category from input or model_id
    let category = input.category.unwrap_or_else(|| {
        if model_id.contains("image") {
            ModelCategory::ImageGeneration
        } else {
            ModelCategory::Llm
        }
    });
    
    match category {
        ModelCategory::Llm => execute_chat(&client, model_id, input).await,
        ModelCategory::ImageGeneration => execute_image_generation(&client, model_id, input).await,
        ModelCategory::VideoGeneration => {
            Err(AgentError::LlmError("Video generation not yet supported for Google".to_string()))
        }
    }
}

/// Execute LLM chat completion.
async fn execute_chat(client: &GeminiClient, model_id: &str, input: ModelInput) -> AgentResult<ModelOutput> {
    use rig_core::completion::Message as RigMessage;
    
    // Build the prompt
    let prompt = input.prompt.unwrap_or_default();
    
    // Get temperature from config
    let temperature: f64 = input
        .config
        .as_ref()
        .and_then(|c| c.get("temperature"))
        .and_then(|v| v.as_f64())
        .unwrap_or(0.7);
    
    // Build chat history if provided
    let history: Vec<RigMessage> = input
        .messages
        .unwrap_or_default()
        .into_iter()
        .filter_map(|msg| {
            match msg.role {
                crate::features::agent::types::MessageRole::User => {
                    Some(RigMessage::user(&msg.content))
                }
                crate::features::agent::types::MessageRole::Assistant => {
                    Some(RigMessage::assistant(&msg.content))
                }
                _ => None,
            }
        })
        .collect();
    
    // Create agent and execute
    let agent = client.inner()
        .agent(model_id)
        .temperature(temperature)
        .build();
    
    let response = if history.is_empty() {
        agent.chat(&prompt, vec![]).await
    } else {
        agent.chat(&prompt, history).await
    };
    
    match response {
        Ok(text) => Ok(ModelOutput::text(text)),
        Err(e) => Err(AgentError::LlmError(format!("Gemini chat error: {}", e))),
    }
}

/// Execute image generation (placeholder - to be implemented).
#[allow(unused_variables)]
async fn execute_image_generation(
    client: &GeminiClient,
    model_id: &str,
    input: ModelInput,
) -> AgentResult<ModelOutput> {
    // TODO: Implement Gemini image generation
    // This will use the Google GenAI SDK for imagen models
    Err(AgentError::LlmError(
        "Image generation via backend not yet implemented. Use frontend execute.".to_string()
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_creation_with_empty_key() {
        let result = GeminiClient::new("".to_string());
        assert!(matches!(
            result,
            Err(AgentError::ApiKeyMissing(_))
        ));
    }

    #[test]
    fn test_client_creation_with_valid_key() {
        // The key format doesn't matter for client creation
        let result = GeminiClient::new("test-api-key".to_string());
        assert!(result.is_ok());
    }

    #[test]
    fn test_default_base_url() {
        assert_eq!(GeminiClient::DEFAULT_BASE_URL, "https://generativelanguage.googleapis.com");
    }
}
