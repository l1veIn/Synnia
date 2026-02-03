//! Provider layer for agent module.
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
pub mod zhipu;
pub mod openai;
pub mod anthropic;
pub mod deepseek;

// Re-export commonly used types and functions
pub use gemini::GeminiClient;
pub use zhipu::ZhipuClient;
pub use openai::OpenAIClient;
pub use anthropic::AnthropicClient;
pub use deepseek::DeepSeekClient;

/// Unified provider client enum.
///
/// This enum wraps all available provider clients, allowing for
/// polymorphic usage throughout the application.
pub enum ProviderClient {
    /// Google Gemini provider
    Google(GeminiClient),
    /// Zhipu AI provider
    Zhipu(ZhipuClient),
    /// OpenAI provider
    OpenAI(OpenAIClient),
    /// Anthropic provider
    Anthropic(AnthropicClient),
    /// DeepSeek provider
    DeepSeek(DeepSeekClient),
}

impl ProviderClient {
    /// Create a provider client from environment variables.
    ///
    /// This reads the API key from the environment and
    /// initializes the appropriate client based on the provider type.
    pub fn from_env(provider: ProviderType) -> ProviderResult<Self> {
        match provider {
            ProviderType::Google => {
                let client = GeminiClient::from_env()?;
                Ok(Self::Google(client))
            }
            ProviderType::Zhipu => {
                let client = ZhipuClient::from_env()?;
                Ok(Self::Zhipu(client))
            }
            ProviderType::OpenAI => {
                let client = OpenAIClient::from_env()?;
                Ok(Self::OpenAI(client))
            }
            ProviderType::Anthropic => {
                let client = AnthropicClient::from_env()?;
                Ok(Self::Anthropic(client))
            }
            ProviderType::DeepSeek => {
                let client = DeepSeekClient::from_env()?;
                Ok(Self::DeepSeek(client))
            }
            _ => Err(ProviderError::UnsupportedProvider(provider.as_str().to_string())),
        }
    }

    /// Get the provider type of this client.
    pub fn provider_type(&self) -> ProviderType {
        match self {
            Self::Google(_) => ProviderType::Google,
            Self::Zhipu(_) => ProviderType::Zhipu,
            Self::OpenAI(_) => ProviderType::OpenAI,
            Self::Anthropic(_) => ProviderType::Anthropic,
            Self::DeepSeek(_) => ProviderType::DeepSeek,
        }
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

    /// Get a reference to the underlying OpenAI client, if this is an OpenAI provider.
    pub fn as_openai(&self) -> Option<&OpenAIClient> {
        match self {
            Self::OpenAI(client) => Some(client),
            _ => None,
        }
    }

    /// Get a reference to the underlying Anthropic client, if this is an Anthropic provider.
    pub fn as_anthropic(&self) -> Option<&AnthropicClient> {
        match self {
            Self::Anthropic(client) => Some(client),
            _ => None,
        }
    }

    /// Get a reference to the underlying DeepSeek client, if this is a DeepSeek provider.
    pub fn as_deepseek(&self) -> Option<&DeepSeekClient> {
        match self {
            Self::DeepSeek(client) => Some(client),
            _ => None,
        }
    }

    /// Execute a one-shot prompt with optional system prompt.
    ///
    /// This is a unified method that handles agent building for all providers.
    pub async fn execute_prompt(
        &self,
        model_id: &str,
        prompt: &str,
        system_prompt: Option<&str>,
    ) -> Result<String, ProviderError> {
        use rig_core::client::CompletionClient;
        use rig_core::completion::Prompt;

        match self {
            Self::Google(client) => {
                let agent = match system_prompt {
                    Some(sys) => client.inner().agent(model_id).preamble(sys).build(),
                    None => client.inner().agent(model_id).build(),
                };
                agent.prompt(prompt).await.map_err(|e| {
                    ProviderError::ExecutionError("google".to_string(), e.to_string())
                })
            }
            Self::Zhipu(client) => {
                let agent = match system_prompt {
                    Some(sys) => client.inner().agent(model_id).preamble(sys).build(),
                    None => client.inner().agent(model_id).build(),
                };
                agent.prompt(prompt).await.map_err(|e| {
                    ProviderError::ExecutionError("zhipu".to_string(), e.to_string())
                })
            }
            Self::OpenAI(client) => {
                let agent = match system_prompt {
                    Some(sys) => client.inner().agent(model_id).preamble(sys).build(),
                    None => client.inner().agent(model_id).build(),
                };
                agent.prompt(prompt).await.map_err(|e| {
                    ProviderError::ExecutionError("openai".to_string(), e.to_string())
                })
            }
            Self::Anthropic(client) => {
                let agent = match system_prompt {
                    Some(sys) => client.inner().agent(model_id).preamble(sys).build(),
                    None => client.inner().agent(model_id).build(),
                };
                agent.prompt(prompt).await.map_err(|e| {
                    ProviderError::ExecutionError("anthropic".to_string(), e.to_string())
                })
            }
            Self::DeepSeek(client) => {
                let agent = match system_prompt {
                    Some(sys) => client.inner().agent(model_id).preamble(sys).build(),
                    None => client.inner().agent(model_id).build(),
                };
                agent.prompt(prompt).await.map_err(|e| {
                    ProviderError::ExecutionError("deepseek".to_string(), e.to_string())
                })
            }
        }
    }
}


/// Provider type identifiers.
///
/// These correspond to the provider types used in the frontend model registry.
/// Exported to TypeScript via ts-rs for frontend type safety.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize, ts_rs::TS)]
#[ts(export)]
#[serde(rename_all = "lowercase")]
pub enum ProviderType {
    /// Google Gemini provider
    Google,
    /// Zhipu AI provider (GLM models)
    Zhipu,
    /// OpenAI provider
    #[serde(rename = "openai")]
    OpenAI,
    /// Anthropic provider (Claude models)
    Anthropic,
    /// DeepSeek provider
    #[serde(rename = "deepseek")]
    DeepSeek,
    /// FAL provider
    Fal,
    /// Ollama provider (local)
    Ollama,
    /// LM Studio provider (local)
    #[serde(rename = "lmstudio")]
    LmStudio,
    /// G4F provider (local)
    #[serde(rename = "g4f")]
    G4f,
    /// ModelScope provider (Alibaba, image/video gen)
    #[serde(rename = "modelscope")]
    ModelScope,
    /// RunningHub provider (ComfyUI cloud)
    #[serde(rename = "runninghub")]
    RunningHub,
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
            ProviderType::ModelScope,
            ProviderType::RunningHub,
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
            "modelscope" => Some(ProviderType::ModelScope),
            "runninghub" => Some(ProviderType::RunningHub),
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
            ProviderType::ModelScope => "modelscope",
            ProviderType::RunningHub => "runninghub",
        }
    }

    /// Check if this provider requires an API key.
    pub fn requires_api_key(&self) -> bool {
        !matches!(self, ProviderType::Ollama | ProviderType::LmStudio | ProviderType::G4f)
        // ModelScope and RunningHub require API keys
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
            ProviderType::ModelScope => Some("MODELSCOPE_API_KEY"),
            ProviderType::RunningHub => Some("RUNNINGHUB_API_KEY"),
            ProviderType::Ollama => None,
            ProviderType::LmStudio => None,
            ProviderType::G4f => None,
        }
    }

    /// Get detailed information about this provider.
    pub fn info(&self) -> crate::features::agent::commands::ProviderInfo {
        use crate::features::agent::commands::ProviderInfo;
        
        match self {
            ProviderType::Google => ProviderInfo {
                key: "google".to_string(),
                name: "Google AI".to_string(),
                description: "Gemini 2.0/2.5/3.0, Imagen".to_string(),
                provider_type: "cloud".to_string(),
                placeholder: "AIza...".to_string(),
                default_base_url: Some("https://generativelanguage.googleapis.com/v1beta".to_string()),
                requires_api_key: true,
            },
            ProviderType::Zhipu => ProviderInfo {
                key: "zhipu".to_string(),
                name: "Zhipu AI".to_string(),
                description: "GLM-4.7, GLM-4.6v, CogView".to_string(),
                provider_type: "cloud".to_string(),
                placeholder: "your-zhipu-api-key".to_string(),
                default_base_url: Some("https://open.bigmodel.cn/api/paas/v4".to_string()),
                requires_api_key: true,
            },
            ProviderType::OpenAI => ProviderInfo {
                key: "openai".to_string(),
                name: "OpenAI".to_string(),
                description: "GPT-4o, GPT-4, DALL-E".to_string(),
                provider_type: "cloud".to_string(),
                placeholder: "sk-...".to_string(),
                default_base_url: Some("https://api.openai.com/v1".to_string()),
                requires_api_key: true,
            },
            ProviderType::Anthropic => ProviderInfo {
                key: "anthropic".to_string(),
                name: "Anthropic".to_string(),
                description: "Claude 3.5 Sonnet, Claude 3 Opus".to_string(),
                provider_type: "cloud".to_string(),
                placeholder: "sk-ant-...".to_string(),
                default_base_url: Some("https://api.anthropic.com".to_string()),
                requires_api_key: true,
            },
            ProviderType::DeepSeek => ProviderInfo {
                key: "deepseek".to_string(),
                name: "DeepSeek".to_string(),
                description: "DeepSeek V3, DeepSeek Coder".to_string(),
                provider_type: "cloud".to_string(),
                placeholder: "sk-...".to_string(),
                default_base_url: Some("https://api.deepseek.com".to_string()),
                requires_api_key: true,
            },
            ProviderType::Fal => ProviderInfo {
                key: "fal".to_string(),
                name: "FAL".to_string(),
                description: "FLUX, Stable Diffusion".to_string(),
                provider_type: "cloud".to_string(),
                placeholder: "your-fal-api-key".to_string(),
                default_base_url: Some("https://fal.run".to_string()),
                requires_api_key: true,
            },
            ProviderType::Ollama => ProviderInfo {
                key: "ollama".to_string(),
                name: "Ollama".to_string(),
                description: "Local LLMs (Llama, Mistral, etc.)".to_string(),
                provider_type: "local".to_string(),
                placeholder: "".to_string(),
                default_base_url: Some("http://localhost:11434".to_string()),
                requires_api_key: false,
            },
            ProviderType::LmStudio => ProviderInfo {
                key: "lmstudio".to_string(),
                name: "LM Studio".to_string(),
                description: "Local LLMs via LM Studio".to_string(),
                provider_type: "local".to_string(),
                placeholder: "".to_string(),
                default_base_url: Some("http://localhost:1234/v1".to_string()),
                requires_api_key: false,
            },
            ProviderType::G4f => ProviderInfo {
                key: "g4f".to_string(),
                name: "G4F".to_string(),
                description: "GPT4Free providers".to_string(),
                provider_type: "local".to_string(),
                placeholder: "".to_string(),
                default_base_url: None,
                requires_api_key: false,
            },
            ProviderType::ModelScope => ProviderInfo {
                key: "modelscope".to_string(),
                name: "ModelScope".to_string(),
                description: "Alibaba AI Model Hub (FLUX, Wan, etc.)".to_string(),
                provider_type: "cloud".to_string(),
                placeholder: "your-modelscope-token".to_string(),
                default_base_url: Some("https://api.modelscope.cn".to_string()),
                requires_api_key: true,
            },
            ProviderType::RunningHub => ProviderInfo {
                key: "runninghub".to_string(),
                name: "RunningHub".to_string(),
                description: "ComfyUI Cloud (Image & Video workflows)".to_string(),
                provider_type: "cloud".to_string(),
                placeholder: "your-runninghub-token".to_string(),
                default_base_url: Some("https://api.runninghub.cn".to_string()),
                requires_api_key: true,
            },
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

    /// Execution error during model invocation
    #[error("Execution error for {0}: {1}")]
    ExecutionError(String, String),

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
        assert_eq!(all.len(), 11);
        assert!(all.contains(&ProviderType::Google));
        assert!(all.contains(&ProviderType::Zhipu));
        assert!(all.contains(&ProviderType::OpenAI));
        assert!(all.contains(&ProviderType::Anthropic));
        assert!(all.contains(&ProviderType::DeepSeek));
        assert!(all.contains(&ProviderType::Fal));
        assert!(all.contains(&ProviderType::Ollama));
        assert!(all.contains(&ProviderType::LmStudio));
        assert!(all.contains(&ProviderType::G4f));
        assert!(all.contains(&ProviderType::ModelScope));
        assert!(all.contains(&ProviderType::RunningHub));
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
