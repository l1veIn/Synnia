//! Provider layer for agent_new module.
//!
//! This module provides a factory pattern for creating provider clients.
//! It checks for available API keys and returns configured providers.
//!
//! ## Architecture
//!
//! - Provider registration is in the backend (Rust)
//! - Model registration is in the frontend (TypeScript)
//! - The `get_available_providers()` function returns providers with configured API keys
//! - Frontend uses this to filter available models

pub mod gemini;

// Re-export commonly used types and functions
pub use gemini::GeminiClient;

/// Provider type identifiers.
///
/// These correspond to the provider types used in the frontend model registry.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ProviderType {
    /// Google Gemini provider
    Google,
    /// Zhipu AI provider (GLM models)
    Zhipu,
    /// OpenAI provider
    OpenAI,
    /// Anthropic provider (Claude models)
    Anthropic,
    /// DeepSeek provider
    DeepSeek,
    /// FAL provider
    Fal,
    /// Ollama provider (local)
    Ollama,
    /// LM Studio provider (local)
    LmStudio,
    /// G4F provider (local)
    G4f,
}

impl ProviderType {
    /// Get all provider types.
    pub fn all() -> &'static [ProviderType] {
        &[
            ProviderType::Google,
            ProviderType::Zhipu,
            ProviderType::OpenAI,
            ProviderType::Anthropic,
            ProviderType::DeepSeek,
            ProviderType::Fal,
            ProviderType::Ollama,
            ProviderType::LmStudio,
            ProviderType::G4f,
        ]
    }

    /// Parse a provider name string into a ProviderType.
    ///
    /// Case-insensitive matching.
    pub fn parse(s: &str) -> Option<ProviderType> {
        match s.to_lowercase().as_str() {
            "google" => Some(ProviderType::Google),
            "zhipu" => Some(ProviderType::Zhipu),
            "openai" => Some(ProviderType::OpenAI),
            "anthropic" => Some(ProviderType::Anthropic),
            "deepseek" => Some(ProviderType::DeepSeek),
            "fal" => Some(ProviderType::Fal),
            "ollama" => Some(ProviderType::Ollama),
            "lmstudio" | "lm-studio" => Some(ProviderType::LmStudio),
            "g4f" => Some(ProviderType::G4f),
            _ => None,
        }
    }

    /// Get the string representation of the provider.
    pub fn as_str(&self) -> &'static str {
        match self {
            ProviderType::Google => "google",
            ProviderType::Zhipu => "zhipu",
            ProviderType::OpenAI => "openai",
            ProviderType::Anthropic => "anthropic",
            ProviderType::DeepSeek => "deepseek",
            ProviderType::Fal => "fal",
            ProviderType::Ollama => "ollama",
            ProviderType::LmStudio => "lmstudio",
            ProviderType::G4f => "g4f",
        }
    }

    /// Check if this provider requires an API key.
    pub fn requires_api_key(&self) -> bool {
        !matches!(self, ProviderType::Ollama | ProviderType::LmStudio | ProviderType::G4f)
    }

    /// Get the environment variable name for this provider's API key.
    pub fn env_key(&self) -> Option<&'static str> {
        match self {
            ProviderType::Google => Some("GOOGLE_API_KEY"),
            ProviderType::Zhipu => Some("ZHIPU_API_KEY"),
            ProviderType::OpenAI => Some("OPENAI_API_KEY"),
            ProviderType::Anthropic => Some("ANTHROPIC_API_KEY"),
            ProviderType::DeepSeek => Some("DEEPSEEK_API_KEY"),
            ProviderType::Fal => Some("FAL_API_KEY"),
            ProviderType::Ollama => None,
            ProviderType::LmStudio => None,
            ProviderType::G4f => None,
        }
    }
}

/// Check if a provider has a configured API key.
///
/// For local providers (Ollama, LM Studio, G4F), this always returns true.
pub fn is_provider_available(provider: ProviderType) -> bool {
    if !provider.requires_api_key() {
        return true;
    }

    provider
        .env_key()
        .map(|key| std::env::var(key).is_ok())
        .unwrap_or(false)
}

/// Get a list of all available providers.
///
/// A provider is considered available if:
/// - It's a local provider (Ollama, LM Studio, G4F), or
/// - It has a configured API key in the environment
pub fn get_available_providers() -> Vec<String> {
    ProviderType::all()
        .iter()
        .filter(|&&p| is_provider_available(p))
        .map(|p| p.as_str().to_string())
        .collect()
}

/// Provider error types.
#[derive(Debug, thiserror::Error)]
pub enum ProviderError {
    /// API key is missing for the provider
    #[error("API key missing for provider: {0}")]
    ApiKeyMissing(String),

    /// Provider is not supported
    #[error("Unsupported provider: {0}")]
    UnsupportedProvider(String),

    /// Failed to create provider client
    #[error("Failed to create {0} client: {1}")]
    ClientCreationError(String, String),

    /// Other provider-related errors
    #[error("Provider error: {0}")]
    Other(String),
}

/// Result type for provider operations.
pub type ProviderResult<T> = Result<T, ProviderError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_type_parse() {
        assert_eq!(ProviderType::parse("google"), Some(ProviderType::Google));
        assert_eq!(ProviderType::parse("GOOGLE"), Some(ProviderType::Google));
        assert_eq!(ProviderType::parse("Google"), Some(ProviderType::Google));
        assert_eq!(ProviderType::parse("zhipu"), Some(ProviderType::Zhipu));
        assert_eq!(ProviderType::parse("openai"), Some(ProviderType::OpenAI));
        assert_eq!(ProviderType::parse("anthropic"), Some(ProviderType::Anthropic));
        assert_eq!(ProviderType::parse("deepseek"), Some(ProviderType::DeepSeek));
        assert_eq!(ProviderType::parse("fal"), Some(ProviderType::Fal));
        assert_eq!(ProviderType::parse("ollama"), Some(ProviderType::Ollama));
        assert_eq!(ProviderType::parse("lmstudio"), Some(ProviderType::LmStudio));
        assert_eq!(ProviderType::parse("lm-studio"), Some(ProviderType::LmStudio));
        assert_eq!(ProviderType::parse("g4f"), Some(ProviderType::G4f));
        assert_eq!(ProviderType::parse("unknown"), None);
        assert_eq!(ProviderType::parse(""), None);
    }

    #[test]
    fn test_provider_type_as_str() {
        assert_eq!(ProviderType::Google.as_str(), "google");
        assert_eq!(ProviderType::Zhipu.as_str(), "zhipu");
        assert_eq!(ProviderType::OpenAI.as_str(), "openai");
        assert_eq!(ProviderType::Anthropic.as_str(), "anthropic");
        assert_eq!(ProviderType::DeepSeek.as_str(), "deepseek");
        assert_eq!(ProviderType::Fal.as_str(), "fal");
        assert_eq!(ProviderType::Ollama.as_str(), "ollama");
        assert_eq!(ProviderType::LmStudio.as_str(), "lmstudio");
        assert_eq!(ProviderType::G4f.as_str(), "g4f");
    }

    #[test]
    fn test_requires_api_key() {
        // Providers that require API keys
        assert!(ProviderType::Google.requires_api_key());
        assert!(ProviderType::Zhipu.requires_api_key());
        assert!(ProviderType::OpenAI.requires_api_key());
        assert!(ProviderType::Anthropic.requires_api_key());
        assert!(ProviderType::DeepSeek.requires_api_key());
        assert!(ProviderType::Fal.requires_api_key());

        // Local providers don't require API keys
        assert!(!ProviderType::Ollama.requires_api_key());
        assert!(!ProviderType::LmStudio.requires_api_key());
        assert!(!ProviderType::G4f.requires_api_key());
    }

    #[test]
    fn test_env_key() {
        assert_eq!(ProviderType::Google.env_key(), Some("GOOGLE_API_KEY"));
        assert_eq!(ProviderType::Zhipu.env_key(), Some("ZHIPU_API_KEY"));
        assert_eq!(ProviderType::OpenAI.env_key(), Some("OPENAI_API_KEY"));
        assert_eq!(ProviderType::Anthropic.env_key(), Some("ANTHROPIC_API_KEY"));
        assert_eq!(ProviderType::DeepSeek.env_key(), Some("DEEPSEEK_API_KEY"));
        assert_eq!(ProviderType::Fal.env_key(), Some("FAL_API_KEY"));
        assert_eq!(ProviderType::Ollama.env_key(), None);
        assert_eq!(ProviderType::LmStudio.env_key(), None);
        assert_eq!(ProviderType::G4f.env_key(), None);
    }

    #[test]
    fn test_local_providers_always_available() {
        // Local providers should always be available
        assert!(is_provider_available(ProviderType::Ollama));
        assert!(is_provider_available(ProviderType::LmStudio));
        assert!(is_provider_available(ProviderType::G4f));
    }

    #[test]
    fn test_get_available_providers() {
        let providers = get_available_providers();
        // Should at least contain local providers
        assert!(providers.contains(&"ollama".to_string()));
        assert!(providers.contains(&"lmstudio".to_string()));
        assert!(providers.contains(&"g4f".to_string()));

        // All returned providers should be valid
        for provider in &providers {
            assert!(ProviderType::parse(provider).is_some());
        }
    }

    #[test]
    fn test_provider_type_all() {
        let all = ProviderType::all();
        assert_eq!(all.len(), 9);
        assert!(all.contains(&ProviderType::Google));
        assert!(all.contains(&ProviderType::Zhipu));
        assert!(all.contains(&ProviderType::OpenAI));
        assert!(all.contains(&ProviderType::Anthropic));
        assert!(all.contains(&ProviderType::DeepSeek));
        assert!(all.contains(&ProviderType::Fal));
        assert!(all.contains(&ProviderType::Ollama));
        assert!(all.contains(&ProviderType::LmStudio));
        assert!(all.contains(&ProviderType::G4f));
    }

    #[test]
    fn test_provider_error_display() {
        let err = ProviderError::ApiKeyMissing("google".to_string());
        assert_eq!(err.to_string(), "API key missing for provider: google");

        let err = ProviderError::UnsupportedProvider("unknown".to_string());
        assert_eq!(err.to_string(), "Unsupported provider: unknown");

        let err = ProviderError::ClientCreationError("google".to_string(), "connection failed".to_string());
        assert_eq!(err.to_string(), "Failed to create google client: connection failed");
    }
}
