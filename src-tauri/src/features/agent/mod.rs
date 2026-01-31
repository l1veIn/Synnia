//! AI Agent module.
//!
//! Backend implementation of AI agents using Rig.rs for multi-step tool calling
//! and unified model management.
//!
//! ## Architecture
//!
//! - **types**: Core type definitions for models, providers, messages
//! - **providers**: Client implementations for Google and Zhipu
//! - **tools**: Tool definitions (nodes, assets, etc.)
//! - **storage**: Persistence layer for sessions and messages
//! - **commands**: Tauri command handlers
//!
//! ## Phases
//!
//! 1. Phase 1: Infrastructure (types and module structure)
//! 2. Phase 2: Storage layer (database schema and repository)
//! 3. Phase 3: Provider layer (Google and Zhipu clients)
//! 4. Phase 4: Model registry (model listing and filtering)
//! 5. Phase 5: State management (runtime session state)
//! 6. Phase 6: Agent engine (core execution logic)
//! 7. Phase 7: Tauri commands (expose API to frontend)

// Re-export public types
pub mod types;

pub use types::{
    AgentError,
    AgentResult,
    Message,
    MessageRole,
    ModelCapability,
    ModelCategory,
    ModelInfo,
    ProviderType,
    SessionInfo,
    AiConfig,
    ProviderCredentials,
};

// Re-export state module types
pub use state::{
    AgentState,
    ChatSession,
    SessionNotFoundError,
};

// Re-export engine types
pub use engine::{
    AgentEngine,
    AgentResponse,
    EngineConfig,
    StreamEvent,
    TokenUsage,
    ToolCallInfo,
};

// Submodules (to be implemented in later phases)
pub mod commands;
pub mod providers;
pub mod tools;
pub mod storage;
pub mod state;
pub mod engine;
