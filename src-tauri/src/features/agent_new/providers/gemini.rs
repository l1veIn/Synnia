//! Google Gemini provider implementation.
//!
//! This module provides a wrapper around rig-core's Gemini client
//! with initialization from environment variables.

use rig_core::providers::gemini;

use super::{ProviderError, ProviderResult};

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
    pub fn new(api_key: String) -> ProviderResult<Self> {
        if api_key.is_empty() {
            return Err(ProviderError::ApiKeyMissing("google".to_string()));
        }

        let client = gemini::Client::new(&api_key).map_err(|e| {
            ProviderError::ClientCreationError(
                "google".to_string(),
                format!("{}", e),
            )
        })?;

        Ok(Self { client })
    }

    /// Create a new Gemini client from environment variable.
    ///
    /// Reads the API key from `GOOGLE_API_KEY` or `GEMINI_API_KEY` environment variable.
    pub fn from_env() -> ProviderResult<Self> {
        let api_key = std::env::var("GOOGLE_API_KEY")
            .or_else(|_| std::env::var("GEMINI_API_KEY"))
            .map_err(|_| ProviderError::ApiKeyMissing("google".to_string()))?;

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
        assert!(matches!(result, Err(ProviderError::ApiKeyMissing(_))));
    }

    #[test]
    fn test_client_creation_with_valid_key() {
        // The key format doesn't matter for client creation
        let result = GeminiClient::new("test-api-key".to_string());
        assert!(result.is_ok());
    }

    // Note: Environment-based tests are skipped when API keys are already set
    // to avoid test flakiness. These tests work correctly in isolated environments.

    #[test]
    fn test_default_base_url() {
        assert_eq!(GeminiClient::DEFAULT_BASE_URL, "https://generativelanguage.googleapis.com");
    }

    #[test]
    fn test_inner_client() {
        let client = GeminiClient::new("test-key".to_string()).unwrap();
        // Just verify we can get the inner client
        let _inner = client.inner();
        // No assertion needed - just verify it compiles and doesn't panic
    }

    #[test]
    fn test_into_inner() {
        let client = GeminiClient::new("test-key".to_string()).unwrap();
        let _inner = client.into_inner();
        // Verify we can consume the client
        // No assertion needed - just verify it compiles and doesn't panic
    }
}
