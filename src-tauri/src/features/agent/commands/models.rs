//! Model-related Tauri commands.
//!
//! Commands for querying available models and their capabilities.

use crate::features::agent::providers::ModelRegistry;
use crate::features::agent::types::{ModelCapability, ModelCategory, ModelInfo};

/// Get available models with optional filtering.
///
/// # Arguments
///
/// * `category` - Optional filter by model category ("llm", "image-generation", "video-generation")
/// * `capabilities` - Optional list of required capabilities (models must have ALL)
/// * `configured_only` - If true, only return models from configured providers
///
/// # Returns
///
/// A vector of ModelInfo objects matching the specified criteria.
///
/// # Examples
///
/// ```no_run
/// # use synnia_chat::features::agent::commands::get_models;
/// // Get all LLM models
/// let models = get_models(Some("llm".to_string()), None, false)?;
///
/// // Get only vision models with function calling
/// let models = get_models(
///     Some("llm".to_string()),
///     Some(vec!["vision".to_string(), "function-calling".to_string()]),
///     false
/// )?;
/// ```
#[tauri::command]
pub fn get_models(
    category: Option<String>,
    capabilities: Option<Vec<String>>,
    configured_only: Option<bool>,
) -> Result<Vec<ModelInfo>, String> {
    // Parse category
    let cat = match category.as_deref() {
        Some("llm") => Some(ModelCategory::Llm),
        Some("image-generation") => Some(ModelCategory::ImageGeneration),
        Some("video-generation") => Some(ModelCategory::VideoGeneration),
        Some(other) => {
            return Err(format!("Unknown category: '{}'. Valid options: llm, image-generation, video-generation", other))
        }
        None => None,
    };

    // Parse capabilities - return empty result if any capability is invalid
    let caps = match capabilities {
        Some(cap_strings) => {
            let parsed: Option<Vec<ModelCapability>> = cap_strings
                .iter()
                .map(|s| match s.as_str() {
                    "chat" => Some(ModelCapability::Chat),
                    "vision" => Some(ModelCapability::Vision),
                    "json-mode" => Some(ModelCapability::JsonMode),
                    "function-calling" => Some(ModelCapability::FunctionCalling),
                    "streaming" => Some(ModelCapability::Streaming),
                    _ => None,
                })
                .collect();

            match parsed {
                Some(caps) => Some(caps),
                None => return Ok(vec![]), // Invalid capability - return empty result
            }
        }
        None => None,
    };

    // Get filtered models
    let models = ModelRegistry::get_models(cat, caps, configured_only.unwrap_or(false));

    Ok(models)
}

/// Get a specific model by ID.
///
/// # Arguments
///
/// * `id` - The model identifier (e.g., "gemini-2.5-flash", "glm-4.7")
///
/// # Returns
///
/// The ModelInfo if found, or an error if not found.
#[tauri::command]
pub fn get_model(id: String) -> Result<ModelInfo, String> {
    ModelRegistry::get_model(&id)
        .ok_or_else(|| format!("Model not found: '{}'", id))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_models_all() {
        let models = get_models(None, None, Some(false));
        assert!(models.is_ok());
        assert_eq!(models.unwrap().len(), 8);
    }

    #[test]
    fn test_get_models_by_category() {
        let models = get_models(Some("llm".to_string()), None, Some(false));
        assert!(models.is_ok());
        assert_eq!(models.unwrap().len(), 8);
    }

    #[test]
    fn test_get_models_invalid_category() {
        let models = get_models(Some("invalid".to_string()), None, Some(false));
        assert!(models.is_err());
    }

    #[test]
    fn test_get_models_by_capability() {
        // Get vision models
        let models = get_models(
            Some("llm".to_string()),
            Some(vec!["vision".to_string()]),
            Some(false),
        );
        assert!(models.is_ok());
        // gemini-2.5-flash, gemini-2.0-flash-exp, gemini-3-pro-preview, gemini-3-flash-preview, glm-4.6v
        assert_eq!(models.unwrap().len(), 5);
    }

    #[test]
    fn test_get_models_by_multiple_capabilities() {
        // Get models with both vision AND function calling
        let models = get_models(
            Some("llm".to_string()),
            Some(vec![
                "vision".to_string(),
                "function-calling".to_string(),
            ]),
            Some(false),
        );
        assert!(models.is_ok());
        // All gemini models + glm-4.6v
        assert_eq!(models.unwrap().len(), 5);
    }

    #[test]
    fn test_get_models_invalid_capability() {
        // Invalid capability returns empty result (not an error)
        let models = get_models(
            Some("llm".to_string()),
            Some(vec!["invalid-capability".to_string()]),
            Some(false),
        );
        assert!(models.is_ok());
        assert!(models.unwrap().is_empty());
    }

    #[test]
    fn test_get_model_found() {
        let model = get_model("gemini-2.5-flash".to_string());
        assert!(model.is_ok());
        let info = model.unwrap();
        assert_eq!(info.id, "gemini-2.5-flash");
        assert_eq!(info.name, "Gemini 2.5 Flash");
    }

    #[test]
    fn test_get_model_not_found() {
        let model = get_model("non-existent-model".to_string());
        assert!(model.is_err());
        assert!(model.unwrap_err().contains("not found"));
    }

    #[test]
    fn test_get_models_configured_only() {
        // With no API keys configured, this should return empty
        let models = get_models(None, None, Some(true));
        assert!(models.is_ok());
        assert!(models.unwrap().is_empty());
    }
}
