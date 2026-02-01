//! Agent_new module - A simplified AI agent chat implementation.
//!
//! This is a reimplementation of the agent/chat modules with:
//! - Backend-driven AI execution
//! - WAL即时持久化
//! - Database connection pooling
//! - Stream event buffering
//! - Streaming/non-streaming fallback

pub mod storage;
pub mod providers;
pub mod tools;
pub mod executor;

// Re-export storage types and functions
pub use storage::{
    get_connection,
    ThreadInfo,
    MessageInfo,
    create_thread,
    get_threads,
    get_thread,
    update_thread_title,
    delete_thread,
    thread_exists,
    save_message,
    get_messages,
    delete_message,
    clear_thread_messages,
    count_messages,
};

// Re-export provider types and functions
pub use providers::{
    ProviderType,
    ProviderError,
    ProviderResult,
    GeminiClient,
    is_provider_available,
    get_available_providers,
};

// Re-export tool types
pub use tools::{
    GetNodesListTool,
    NodeInfo,
    NodesToolError,
    GetNodesListArgs,
};

// Re-export executor types
pub use executor::{
    StreamEvent,
    StreamBuffer,
    AgentExecutor,
    ExecutorError,
    ExecutorResult,
    ExecutorResponse,
    ToolCallInfo,
};
