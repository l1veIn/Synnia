//! Provider registry and client factory.
//!
//! This module provides a unified interface for creating provider clients
//! from the application settings, as well as a registry of available models.

use super::google::GeminiClient;
use super::zhipu::ZhipuClient;
use crate::features::agent::types::{
    AgentError, AgentResult, ModelCapability, ModelCategory, ModelInfo, ProviderType,
};
use std::collections::HashSet;

/// Unified provider client enum.
///
/// This enum wraps all available provider clients, allowing for
/// polymorphic usage throughout the application.
pub enum ProviderClient {
    /// Google Gemini provider
    Google(GeminiClient),
    /// Zhipu AI provider
    Zhipu(ZhipuClient),
}

impl ProviderClient {
    /// Create a provider client from the global settings.
    ///
    /// This reads the API configuration from the global database and
    /// initializes the appropriate client based on the provider type.
    ///
    /// # Errors
    ///
    /// Returns `AgentError::ApiKeyMissing` if the provider's API key is not configured.
    /// Returns `AgentError::UnsupportedProvider` if the provider type is not recognized.
    pub fn from_settings(provider: ProviderType) -> AgentResult<Self> {
        match provider {
            ProviderType::Google => {
                let client = GeminiClient::from_settings()?;
                Ok(Self::Google(client))
            }
            ProviderType::Zhipu => {
                let client = ZhipuClient::from_settings()?;
                Ok(Self::Zhipu(client))
            }
        }
    }

    /// Create a provider client with an explicit API key.
    ///
    /// This is useful for testing or when you want to override the stored settings.
    pub fn with_api_key(provider: ProviderType, api_key: String) -> AgentResult<Self> {
        match provider {
            ProviderType::Google => {
                let client = GeminiClient::new(api_key)?;
                Ok(Self::Google(client))
            }
            ProviderType::Zhipu => {
                let client = ZhipuClient::new(api_key)?;
                Ok(Self::Zhipu(client))
            }
        }
    }

    /// Get the provider type of this client.
    pub fn provider_type(&self) -> ProviderType {
        match self {
            Self::Google(_) => ProviderType::Google,
            Self::Zhipu(_) => ProviderType::Zhipu,
        }
    }

    /// Check if a provider is configured in the global settings.
    ///
    /// This checks if the provider has a valid API key stored.
    pub fn is_configured(provider: ProviderType) -> bool {
        match provider {
            ProviderType::Google => GeminiClient::from_settings().is_ok(),
            ProviderType::Zhipu => ZhipuClient::from_settings().is_ok(),
        }
    }

    /// Get a list of all configured providers.
    ///
    /// A provider is considered configured if it has a valid API key.
    pub fn configured_providers() -> Vec<ProviderType> {
        ProviderType::all()
            .iter()
            .filter(|&&p| Self::is_configured(p))
            .copied()
            .collect()
    }

    /// Get a reference to the underlying Gemini client, if this is a Google provider.
    pub fn as_google(&self) -> Option<&GeminiClient> {
        match self {
            Self::Google(client) => Some(client),
            _ => None,
        }
    }

    /// Get a reference to the underlying Zhipu client, if this is a Zhipu provider.
    pub fn as_zhipu(&self) -> Option<&ZhipuClient> {
        match self {
            Self::Zhipu(client) => Some(client),
            _ => None,
        }
    }
}

/// Parse a provider name string into a ProviderType.
///
/// This is a convenience function for parsing user input.
pub fn parse_provider(s: &str) -> Result<ProviderType, AgentError> {
    ProviderType::parse(s).ok_or_else(|| {
        AgentError::UnsupportedProvider(format!(
            "Unknown provider: '{}'. Valid options are: google, zhipu",
            s
        ))
    })
}

// ============================================================================
// Model Registry
// ============================================================================

/// Registry of all available AI models.
///
/// This struct maintains a static list of all supported models across
/// all providers, with filtering capabilities based on:
/// - Provider availability (API key configured)
/// - Model category (llm, image-generation, video-generation)
/// - Model capabilities (chat, vision, function-calling, etc.)
pub struct ModelRegistry;

impl ModelRegistry {
    /// Get all registered models.
    ///
    /// Returns the full list of models regardless of provider configuration.
    pub fn all_models() -> Vec<ModelInfo> {
        vec![
            // Google Gemini Models
            Self::gemini_25_flash(),
            Self::gemini_2_flash(),
            Self::gemini_3_pro(),
            Self::gemini_3_flash(),
            // Zhipu GLM Models
            Self::glm_47(),
            Self::glm_46v(),
            Self::glm_4_flash(),
            Self::glm_47_flash(),
        ]
    }

    /// Get models with optional filtering.
    ///
    /// # Arguments
    ///
    /// * `category` - Optional filter by model category
    /// * `capabilities` - Optional filter by required capabilities (models must have ALL)
    /// * `configured_only` - If true, only return models from configured providers
    ///
    /// # Returns
    ///
    /// A filtered list of models matching all specified criteria.
    pub fn get_models(
        category: Option<ModelCategory>,
        capabilities: Option<Vec<ModelCapability>>,
        configured_only: bool,
    ) -> Vec<ModelInfo> {
        let mut models = Self::all_models();

        // Filter by category
        if let Some(cat) = category {
            models.retain(|m| m.category == cat);
        }

        // Filter by capabilities (model must have ALL requested capabilities)
        if let Some(caps) = capabilities {
            models.retain(|m| {
                m.capabilities
                    .as_ref()
                    .map(|model_caps| {
                        let required: HashSet<_> = caps.iter().collect();
                        let available: HashSet<_> = model_caps.iter().collect();
                        required.is_subset(&available)
                    })
                    .unwrap_or(false)
            });
        }

        // Filter by configured providers
        if configured_only {
            models.retain(|m| ProviderClient::is_configured(m.provider));
        }

        models
    }

    /// Get a model by its ID.
    ///
    /// # Returns
    ///
    /// `Some(ModelInfo)` if found, `None` otherwise.
    pub fn get_model(id: &str) -> Option<ModelInfo> {
        Self::all_models()
            .into_iter()
            .find(|m| m.id == id)
    }

    // Google Gemini Models

    fn gemini_25_flash() -> ModelInfo {
        ModelInfo {
            id: "gemini-2.5-flash".to_string(),
            name: "Gemini 2.5 Flash".to_string(),
            provider: ProviderType::Google,
            category: ModelCategory::Llm,
            capabilities: Some(vec![
                ModelCapability::Chat,
                ModelCapability::Vision,
                ModelCapability::FunctionCalling,
                ModelCapability::JsonMode,
                ModelCapability::Streaming,
            ]),
            context_window: Some(1_000_000),
            max_output_tokens: Some(65_536),
            default_temperature: Some(0.7),
            requires_api_key: true,
        }
    }

    fn gemini_2_flash() -> ModelInfo {
        ModelInfo {
            id: "gemini-2.0-flash-exp".to_string(),
            name: "Gemini 2.0 Flash".to_string(),
            provider: ProviderType::Google,
            category: ModelCategory::Llm,
            capabilities: Some(vec![
                ModelCapability::Chat,
                ModelCapability::Vision,
                ModelCapability::FunctionCalling,
                ModelCapability::JsonMode,
                ModelCapability::Streaming,
            ]),
            context_window: Some(1_000_000),
            max_output_tokens: Some(8192),
            default_temperature: Some(0.7),
            requires_api_key: true,
        }
    }

    fn gemini_3_pro() -> ModelInfo {
        ModelInfo {
            id: "gemini-3-pro-preview".to_string(),
            name: "Gemini 3.0 Pro".to_string(),
            provider: ProviderType::Google,
            category: ModelCategory::Llm,
            capabilities: Some(vec![
                ModelCapability::Chat,
                ModelCapability::Vision,
                ModelCapability::FunctionCalling,
                ModelCapability::JsonMode,
                ModelCapability::Streaming,
            ]),
            context_window: Some(2_000_000),
            max_output_tokens: Some(65_536),
            default_temperature: Some(0.7),
            requires_api_key: true,
        }
    }

    fn gemini_3_flash() -> ModelInfo {
        ModelInfo {
            id: "gemini-3-flash-preview".to_string(),
            name: "Gemini 3.0 Flash".to_string(),
            provider: ProviderType::Google,
            category: ModelCategory::Llm,
            capabilities: Some(vec![
                ModelCapability::Chat,
                ModelCapability::Vision,
                ModelCapability::FunctionCalling,
                ModelCapability::JsonMode,
                ModelCapability::Streaming,
            ]),
            context_window: Some(1_000_000),
            max_output_tokens: Some(32_768),
            default_temperature: Some(0.7),
            requires_api_key: true,
        }
    }

    // Zhipu GLM Models

    fn glm_47() -> ModelInfo {
        ModelInfo {
            id: "glm-4.7".to_string(),
            name: "GLM-4.7".to_string(),
            provider: ProviderType::Zhipu,
            category: ModelCategory::Llm,
            capabilities: Some(vec![
                ModelCapability::Chat,
                ModelCapability::FunctionCalling,
                ModelCapability::JsonMode,
                ModelCapability::Streaming,
            ]),
            context_window: Some(200_000),
            max_output_tokens: Some(96_000),
            default_temperature: Some(0.7),
            requires_api_key: true,
        }
    }

    fn glm_46v() -> ModelInfo {
        ModelInfo {
            id: "glm-4.6v".to_string(),
            name: "GLM-4.6v".to_string(),
            provider: ProviderType::Zhipu,
            category: ModelCategory::Llm,
            capabilities: Some(vec![
                ModelCapability::Chat,
                ModelCapability::Vision,
                ModelCapability::FunctionCalling,
                ModelCapability::JsonMode,
                ModelCapability::Streaming,
            ]),
            context_window: Some(200_000),
            max_output_tokens: Some(96_000),
            default_temperature: Some(0.7),
            requires_api_key: true,
        }
    }

    fn glm_4_flash() -> ModelInfo {
        ModelInfo {
            id: "glm-4-flash".to_string(),
            name: "GLM-4-Flash".to_string(),
            provider: ProviderType::Zhipu,
            category: ModelCategory::Llm,
            capabilities: Some(vec![
                ModelCapability::Chat,
                ModelCapability::FunctionCalling,
                ModelCapability::JsonMode,
                ModelCapability::Streaming,
            ]),
            context_window: Some(128_000),
            max_output_tokens: Some(16_000),
            default_temperature: Some(0.7),
            requires_api_key: true,
        }
    }

    fn glm_47_flash() -> ModelInfo {
        ModelInfo {
            id: "glm-4.7-flash".to_string(),
            name: "GLM-4.7-Flash".to_string(),
            provider: ProviderType::Zhipu,
            category: ModelCategory::Llm,
            capabilities: Some(vec![
                ModelCapability::Chat,
                ModelCapability::FunctionCalling,
                ModelCapability::JsonMode,
                ModelCapability::Streaming,
            ]),
            context_window: Some(200_000),
            max_output_tokens: Some(96_000),
            default_temperature: Some(0.7),
            requires_api_key: true,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_provider_valid() {
        assert_eq!(parse_provider("google").unwrap(), ProviderType::Google);
        assert_eq!(parse_provider("zhipu").unwrap(), ProviderType::Zhipu);
        assert_eq!(parse_provider("GOOGLE").unwrap(), ProviderType::Google);
        assert_eq!(parse_provider("Zhipu").unwrap(), ProviderType::Zhipu);
    }

    #[test]
    fn test_parse_provider_invalid() {
        assert!(parse_provider("openai").is_err());
        assert!(parse_provider("anthropic").is_err());
        assert!(parse_provider("").is_err());
    }

    #[test]
    fn test_provider_type_from_settings() {
        // These will fail with ApiKeyMissing since we don't have actual keys
        // in the test environment, but we can verify the error type
        let result = ProviderClient::from_settings(ProviderType::Google);
        assert!(result.is_err());

        let result = ProviderClient::from_settings(ProviderType::Zhipu);
        assert!(result.is_err());
    }

    #[test]
    fn test_provider_with_api_key() {
        let google = ProviderClient::with_api_key(ProviderType::Google, "test-key".to_string());
        assert!(google.is_ok());
        assert!(matches!(google.unwrap(), ProviderClient::Google(_)));

        let zhipu = ProviderClient::with_api_key(ProviderType::Zhipu, "test-key".to_string());
        assert!(zhipu.is_ok());
        assert!(matches!(zhipu.unwrap(), ProviderClient::Zhipu(_)));
    }

    #[test]
    fn test_provider_with_empty_api_key() {
        let google = ProviderClient::with_api_key(ProviderType::Google, "".to_string());
        assert!(matches!(
            google,
            Err(AgentError::ApiKeyMissing(_))
        ));

        let zhipu = ProviderClient::with_api_key(ProviderType::Zhipu, "".to_string());
        assert!(matches!(
            zhipu,
            Err(AgentError::ApiKeyMissing(_))
        ));
    }

    #[test]
    fn test_provider_type_accessor() {
        let google = ProviderClient::with_api_key(ProviderType::Google, "test-key".to_string()).unwrap();
        assert_eq!(google.provider_type(), ProviderType::Google);

        let zhipu = ProviderClient::with_api_key(ProviderType::Zhipu, "test-key".to_string()).unwrap();
        assert_eq!(zhipu.provider_type(), ProviderType::Zhipu);
    }

    #[test]
    fn test_as_google() {
        let google = ProviderClient::with_api_key(ProviderType::Google, "test-key".to_string()).unwrap();
        assert!(google.as_google().is_some());
        assert!(google.as_zhipu().is_none());
    }

    #[test]
    fn test_as_zhipu() {
        let zhipu = ProviderClient::with_api_key(ProviderType::Zhipu, "test-key".to_string()).unwrap();
        assert!(zhipu.as_zhipu().is_some());
        assert!(zhipu.as_google().is_none());
    }

    // ModelRegistry tests

    #[test]
    fn test_all_models() {
        let models = ModelRegistry::all_models();
        assert_eq!(models.len(), 8);

        // Verify Google models
        assert!(models.iter().any(|m| m.id == "gemini-2.5-flash"));
        assert!(models.iter().any(|m| m.id == "gemini-2.0-flash-exp"));
        assert!(models.iter().any(|m| m.id == "gemini-3-pro-preview"));
        assert!(models.iter().any(|m| m.id == "gemini-3-flash-preview"));

        // Verify Zhipu models
        assert!(models.iter().any(|m| m.id == "glm-4.7"));
        assert!(models.iter().any(|m| m.id == "glm-4.6v"));
        assert!(models.iter().any(|m| m.id == "glm-4-flash"));
        assert!(models.iter().any(|m| m.id == "glm-4.7-flash"));
    }

    #[test]
    fn test_get_model() {
        let gemini = ModelRegistry::get_model("gemini-2.5-flash");
        assert!(gemini.is_some());
        assert_eq!(gemini.unwrap().provider, ProviderType::Google);

        let glm = ModelRegistry::get_model("glm-4.7");
        assert!(glm.is_some());
        assert_eq!(glm.unwrap().provider, ProviderType::Zhipu);

        let unknown = ModelRegistry::get_model("unknown-model");
        assert!(unknown.is_none());
    }

    #[test]
    fn test_filter_by_capability() {
        // All models should have chat capability
        let all_chat = ModelRegistry::get_models(
            Some(ModelCategory::Llm),
            Some(vec![ModelCapability::Chat]),
            false,
        );
        assert_eq!(all_chat.len(), 8);

        // Only vision models
        let vision_only = ModelRegistry::get_models(
            Some(ModelCategory::Llm),
            Some(vec![ModelCapability::Vision]),
            false,
        );
        // gemini-2.5-flash, gemini-2.0-flash-exp, gemini-3-pro-preview, gemini-3-flash-preview, glm-4.6v
        assert_eq!(vision_only.len(), 5);

        // Function calling models (all LLMs support it)
        let fc_models = ModelRegistry::get_models(
            Some(ModelCategory::Llm),
            Some(vec![ModelCapability::FunctionCalling]),
            false,
        );
        assert_eq!(fc_models.len(), 8);
    }

    #[test]
    fn test_filter_by_category() {
        // LLM models only
        let llm_only = ModelRegistry::get_models(Some(ModelCategory::Llm), None, false);
        assert_eq!(llm_only.len(), 8);

        // Image generation (none in Phase 4)
        let img_gen = ModelRegistry::get_models(Some(ModelCategory::ImageGeneration), None, false);
        assert!(img_gen.is_empty());

        // Video generation (none in Phase 4)
        let vid_gen = ModelRegistry::get_models(Some(ModelCategory::VideoGeneration), None, false);
        assert!(vid_gen.is_empty());
    }

    #[test]
    fn test_filter_unavailable_providers() {
        // Without configured_only, we get all models
        let all = ModelRegistry::get_models(None, None, false);
        assert_eq!(all.len(), 8);

        // With configured_only=true, we get only models from configured providers
        // Since no keys are configured in test environment, this should be empty
        let configured = ModelRegistry::get_models(None, None, true);
        assert!(configured.is_empty());
    }

    #[test]
    fn test_filter_combined() {
        // Combine multiple filters: LLM + Vision + Streaming
        let filtered = ModelRegistry::get_models(
            Some(ModelCategory::Llm),
            Some(vec![ModelCapability::Vision, ModelCapability::Streaming]),
            false,
        );
        // gemini-2.5-flash, gemini-2.0-flash-exp, gemini-3-pro-preview, gemini-3-flash-preview, glm-4.6v
        assert_eq!(filtered.len(), 5);

        // Verify all returned models have the requested capabilities
        for model in &filtered {
            let caps = model.capabilities.as_ref().unwrap();
            assert!(caps.contains(&ModelCapability::Vision));
            assert!(caps.contains(&ModelCapability::Streaming));
        }
    }
}
