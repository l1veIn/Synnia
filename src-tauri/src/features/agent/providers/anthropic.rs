//! Anthropic (Claude) provider implementation.
//!
//! This module provides a wrapper around rig-core's Anthropic client
//! with initialization from environment variables.

use rig_core::providers::anthropic;

use super::{ProviderError, ProviderResult};

/// Wrapper for Anthropic client.
pub struct AnthropicClient {
    /// The underlying rig-core Anthropic client
    client: anthropic::Client,
}

impl AnthropicClient {
    /// Base URL for Anthropic API.
    #[allow(dead_code)]
    const DEFAULT_BASE_URL: &str = "https://api.anthropic.com";

    /// Create a new Anthropic client from an API key.
    pub fn new(api_key: String) -> ProviderResult<Self> {
        if api_key.is_empty() {
            return Err(ProviderError::ApiKeyMissing("anthropic".to_string()));
        }

        let client = anthropic::Client::new(&api_key).map_err(|e| {
            ProviderError::ClientCreationError(
                "anthropic".to_string(),
                format!("{}", e),
            )
        })?;

        Ok(Self { client })
    }


    /// Create a new Anthropic client from environment variable.
    ///
    /// Reads the API key from `ANTHROPIC_API_KEY` environment variable.
    pub fn from_env() -> ProviderResult<Self> {
        let api_key = std::env::var("ANTHROPIC_API_KEY")
            .map_err(|_| ProviderError::ApiKeyMissing("anthropic".to_string()))?;

        Self::new(api_key)
    }

    /// Get a reference to the underlying Anthropic client.
    pub fn inner(&self) -> &anthropic::Client {
        &self.client
    }

    /// Consume and return the underlying Anthropic client.
    pub fn into_inner(self) -> anthropic::Client {
        self.client
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_creation_with_empty_key() {
        let result = AnthropicClient::new("".to_string());
        assert!(matches!(result, Err(ProviderError::ApiKeyMissing(_))));
    }

    #[test]
    fn test_client_creation_with_valid_key() {
        let result = AnthropicClient::new("sk-ant-test-key".to_string());
        assert!(result.is_ok());
    }

    #[test]
    fn test_default_base_url() {
        assert_eq!(AnthropicClient::DEFAULT_BASE_URL, "https://api.anthropic.com");
    }
}
