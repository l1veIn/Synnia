//! Zhipu AI provider implementation.
//!
//! This module provides a wrapper around rig-core's OpenAI-compatible client
//! for Zhipu AI's GLM models.
//!
//! Zhipu AI provides an OpenAI-compatible API at:
//! Base URL: https://open.bigmodel.cn/api/paas/v4/

use rig::providers::openai;

use crate::features::agent::types::{AgentError, AgentResult, AiConfig};
use crate::global::database;
use crate::global::settings;

/// Base URL for Zhipu AI OpenAI-compatible API.
pub const ZHIPU_BASE_URL: &str = "https://open.bigmodel.cn/api/paas/v4/";

/// Wrapper for Zhipu AI client using OpenAI-compatible API.
pub struct ZhipuClient {
    /// The underlying rig-core OpenAI client configured for Zhipu
    client: openai::Client,
}

impl ZhipuClient {
    /// Create a new Zhipu client from an API key.
    pub fn new(api_key: String) -> AgentResult<Self> {
        if api_key.is_empty() {
            return Err(AgentError::ApiKeyMissing("zhipu".to_string()));
        }

        // Use OpenAI-compatible client with Zhipu base URL
        let client = openai::Client::from_url(&api_key, ZHIPU_BASE_URL);

        Ok(Self { client })
    }

    /// Create a new Zhipu client from global settings.
    ///
    /// Reads the API key from the global database's ai_config.
    pub fn from_settings() -> AgentResult<Self> {
        let conn = database::init_global_db()?;
        let ai_config_json: Option<String> = settings::get_setting(&conn, "ai_config")?;

        let api_key = ai_config_json
            .and_then(|json| {
                let config: AiConfig = serde_json::from_str(&json).ok()?;
                config.get_api_key("zhipu")
            })
            .ok_or_else(|| AgentError::ApiKeyMissing("zhipu".to_string()))?;

        Self::new(api_key)
    }

    /// Create a new Zhipu client with a custom base URL.
    ///
    /// This is useful for testing or when using a proxy.
    pub fn with_base_url(api_key: String, base_url: String) -> AgentResult<Self> {
        if api_key.is_empty() {
            return Err(AgentError::ApiKeyMissing("zhipu".to_string()));
        }

        let client = openai::Client::from_url(&api_key, &base_url);

        Ok(Self { client })
    }

    /// Get a reference to the underlying OpenAI client.
    pub fn inner(&self) -> &openai::Client {
        &self.client
    }

    /// Consume and return the underlying OpenAI client.
    pub fn into_inner(self) -> openai::Client {
        self.client
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

    #[test]
    fn test_client_with_custom_base_url() {
        let result = ZhipuClient::with_base_url(
            "test-api-key".to_string(),
            "https://custom.example.com/v1/".to_string(),
        );
        assert!(result.is_ok());
    }

    #[test]
    fn test_zhipu_base_url_constant() {
        assert_eq!(ZHIPU_BASE_URL, "https://open.bigmodel.cn/api/paas/v4/");
    }
}
