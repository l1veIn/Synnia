//! Provider client implementations.
//!
//! This module provides unified access to Google Gemini and Zhipu AI providers.
//!
//! # Example
//!
//! ```no_run
//! use crate::features::agent::providers::{ProviderClient, parse_provider};
//! use crate::features::agent::types::ProviderType;
//!
//! // Create a provider from settings
//! let provider = ProviderClient::from_settings(ProviderType::Google)?;
//!
//! // Or parse from string
//! let provider_type = parse_provider("google")?;
//! let provider = ProviderClient::from_settings(provider_type)?;
//! ```

pub mod registry;
pub mod google;
pub mod zhipu;

// Re-export commonly used types
pub use registry::{ProviderClient, parse_provider};
pub use google::GeminiClient;
pub use zhipu::{ZhipuClient, ZHIPU_BASE_URL};
