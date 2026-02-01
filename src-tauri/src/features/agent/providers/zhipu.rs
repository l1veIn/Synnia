//! Zhipu AI provider implementation.
//!
//! This module provides a wrapper around rig-core's native Zhipu client.
//! Uses the official Zhipu provider from the Serein-sz/rig fork.
//!
//! Zhipu AI provides GLM models at:
//! Base URL: https://open.bigmodel.cn/api/paas/v4/

use rig_core::providers::zhipu;

use crate::features::agent::types::{AgentError, AgentResult, AiConfig};
use crate::global::database;
use crate::global::settings;

/// Wrapper for Zhipu AI client using native rig-core Zhipu provider.
pub struct ZhipuClient {
    /// The underlying rig-core Zhipu client
    client: zhipu::Client,
}

impl ZhipuClient {
    /// Create a new Zhipu client from an API key.
    pub fn new(api_key: String) -> AgentResult<Self> {
        if api_key.is_empty() {
            return Err(AgentError::ApiKeyMissing("zhipu".to_string()));
        }

        // Use native Zhipu client
        let client = zhipu::Client::new(&api_key)
            .map_err(|e| AgentError::LlmError(format!("Failed to create Zhipu client: {}", e)))?;

        Ok(Self { client })
    }

    /// Create a new Zhipu client from global settings.
    ///
    /// Reads the API key from the global database's app_settings.
    pub fn from_settings() -> AgentResult<Self> {
        let conn = database::init_global_db()?;
        // Note: The key is "app_settings", not "ai_config"
        let ai_config_json: Option<String> = settings::get_setting(&conn, "app_settings")?;

        let api_key = ai_config_json
            .and_then(|json| {
                let config: AiConfig = serde_json::from_str(&json).ok()?;
                config.get_api_key("zhipu")
            })
            .ok_or_else(|| AgentError::ApiKeyMissing("zhipu".to_string()))?;

        Self::new(api_key)
    }

    /// Get a reference to the underlying Zhipu client.
    pub fn inner(&self) -> &zhipu::Client {
        &self.client
    }

    /// Consume and return the underlying Zhipu client.
    pub fn into_inner(self) -> zhipu::Client {
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
/// Currently only supports LLM chat completion.
pub async fn execute(model_id: &str, input: ModelInput) -> AgentResult<ModelOutput> {
    let client = ZhipuClient::from_settings()?;
    
    // Zhipu currently only supports LLM
    let category = input.category.unwrap_or(ModelCategory::Llm);
    
    match category {
        ModelCategory::Llm => execute_chat(&client, model_id, input).await,
        _ => Err(AgentError::LlmError(
            "Zhipu only supports LLM models".to_string()
        )),
    }
}

/// Execute LLM chat completion.
async fn execute_chat(client: &ZhipuClient, model_id: &str, input: ModelInput) -> AgentResult<ModelOutput> {
    use rig_core::completion::Message as RigMessage;
    
    let prompt = input.prompt.unwrap_or_default();
    
    let temperature: f64 = input
        .config
        .as_ref()
        .and_then(|c| c.get("temperature"))
        .and_then(|v| v.as_f64())
        .unwrap_or(0.7);
    
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
        Err(e) => Err(AgentError::LlmError(format!("Zhipu chat error: {}", e))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_creation_with_empty_key() {
        let result = ZhipuClient::new("".to_string());
        assert!(matches!(
            result,
            Err(AgentError::ApiKeyMissing(_))
        ));
    }

    #[test]
    fn test_client_creation_with_valid_key() {
        // The key format doesn't matter for client creation
        let result = ZhipuClient::new("test-api-key".to_string());
        assert!(result.is_ok());
    }
}
