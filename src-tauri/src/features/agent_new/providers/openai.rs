//! OpenAI provider implementation.
//!
//! This module provides a wrapper around rig-core's OpenAI client
//! with initialization from environment variables.

use rig_core::providers::openai;

use super::{ProviderError, ProviderResult};

/// Wrapper for OpenAI client.
pub struct OpenAIClient {
    /// The underlying rig-core OpenAI client
    client: openai::Client,
}

impl OpenAIClient {
    /// Base URL for OpenAI API.
    #[allow(dead_code)]
    const DEFAULT_BASE_URL: &str = "https://api.openai.com/v1";

    /// Create a new OpenAI client from an API key.
    pub fn new(api_key: String) -> ProviderResult<Self> {
        if api_key.is_empty() {
            return Err(ProviderError::ApiKeyMissing("openai".to_string()));
        }

        let client = openai::Client::new(&api_key).map_err(|e| {
            ProviderError::ClientCreationError(
                "openai".to_string(),
                format!("{}", e),
            )
        })?;

        Ok(Self { client })
    }


    /// Create a new OpenAI client from environment variable.
    ///
    /// Reads the API key from `OPENAI_API_KEY` environment variable.
    pub fn from_env() -> ProviderResult<Self> {
        let api_key = std::env::var("OPENAI_API_KEY")
            .map_err(|_| ProviderError::ApiKeyMissing("openai".to_string()))?;

        Self::new(api_key)
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
        let result = OpenAIClient::new("".to_string());
        assert!(matches!(result, Err(ProviderError::ApiKeyMissing(_))));
    }

    #[test]
    fn test_client_creation_with_valid_key() {
        let result = OpenAIClient::new("sk-test-api-key".to_string());
        assert!(result.is_ok());
    }

    #[test]
    fn test_default_base_url() {
        assert_eq!(OpenAIClient::DEFAULT_BASE_URL, "https://api.openai.com/v1");
    }
}
