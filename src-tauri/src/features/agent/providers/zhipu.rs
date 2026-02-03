//! Zhipu AI provider implementation.
//!
//! This module provides a wrapper around rig-core's native Zhipu client.

use rig_core::providers::zhipu;

use super::{ProviderError, ProviderResult};

/// Wrapper for Zhipu AI client.
pub struct ZhipuClient {
    /// The underlying rig-core Zhipu client
    client: zhipu::Client,
}

impl ZhipuClient {
    /// Create a new Zhipu client from an API key.
    pub fn new(api_key: String) -> ProviderResult<Self> {
        if api_key.is_empty() {
            return Err(ProviderError::ApiKeyMissing("zhipu".to_string()));
        }

        let client = zhipu::Client::new(&api_key).map_err(|e| {
            ProviderError::ClientCreationError("zhipu".to_string(), e.to_string())
        })?;

        Ok(Self { client })
    }

    /// Create a new Zhipu client from environment variable.
    pub fn from_env() -> ProviderResult<Self> {
        let api_key = std::env::var("ZHIPU_API_KEY")
            .map_err(|_| ProviderError::ApiKeyMissing("zhipu".to_string()))?;

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_creation_with_empty_key() {
        let result = ZhipuClient::new("".to_string());
        assert!(matches!(result, Err(ProviderError::ApiKeyMissing(_))));
    }

    #[test]
    fn test_client_creation_with_valid_key() {
        let result = ZhipuClient::new("test-api-key".to_string());
        assert!(result.is_ok());
    }
}
