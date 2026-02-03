//! DeepSeek provider implementation.
//!
//! DeepSeek uses an OpenAI-compatible API, so we use rig-core's OpenAI client
//! with a custom base URL.

use rig_core::providers::openai;

use super::{ProviderError, ProviderResult};

/// Wrapper for DeepSeek client (OpenAI-compatible).
pub struct DeepSeekClient {
    /// The underlying rig-core OpenAI client configured for DeepSeek
    client: openai::Client,
}

impl DeepSeekClient {
    /// Base URL for DeepSeek API.
    pub const DEFAULT_BASE_URL: &str = "https://api.deepseek.com";

    /// Create a new DeepSeek client from an API key.
    pub fn new(api_key: String) -> ProviderResult<Self> {
        if api_key.is_empty() {
            return Err(ProviderError::ApiKeyMissing("deepseek".to_string()));
        }

        // Use OpenAI client builder with DeepSeek base URL
        let client = openai::Client::builder()
            .api_key(&api_key)
            .base_url(Self::DEFAULT_BASE_URL)
            .build()
            .map_err(|e| {
                ProviderError::ClientCreationError(
                    "deepseek".to_string(),
                    format!("{}", e),
                )
            })?;

        Ok(Self { client })
    }

    /// Create a new DeepSeek client from environment variable.
    ///
    /// Reads the API key from `DEEPSEEK_API_KEY` environment variable.
    pub fn from_env() -> ProviderResult<Self> {
        let api_key = std::env::var("DEEPSEEK_API_KEY")
            .map_err(|_| ProviderError::ApiKeyMissing("deepseek".to_string()))?;

        Self::new(api_key)
    }

    /// Get a reference to the underlying client.
    pub fn inner(&self) -> &openai::Client {
        &self.client
    }

    /// Consume and return the underlying client.
    pub fn into_inner(self) -> openai::Client {
        self.client
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_creation_with_empty_key() {
        let result = DeepSeekClient::new("".to_string());
        assert!(matches!(result, Err(ProviderError::ApiKeyMissing(_))));
    }

    #[test]
    fn test_client_creation_with_valid_key() {
        let result = DeepSeekClient::new("sk-test-key".to_string());
        assert!(result.is_ok());
    }

    #[test]
    fn test_default_base_url() {
        assert_eq!(DeepSeekClient::DEFAULT_BASE_URL, "https://api.deepseek.com");
    }
}
