//! Google Gemini provider implementation.
//!
//! This module provides a wrapper around rig-core's gemini client
//! with initialization from the application settings.

use rig::providers::gemini;

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

        let client = gemini::Client::new(&api_key);

        Ok(Self { client })
    }

    /// Create a new Gemini client from global settings.
    ///
    /// Reads the API key from the global database's ai_config.
    pub fn from_settings() -> AgentResult<Self> {
        let conn = database::init_global_db()?;
        let ai_config_json: Option<String> = settings::get_setting(&conn, "ai_config")?;

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
