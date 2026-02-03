//! Agent module - A simplified AI agent chat implementation.
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
pub mod commands;

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

// Re-export commands
pub use commands::{
    // Thread commands
    get_threads_command,
    get_thread_command,
    create_thread_command,
    update_thread_command,
    delete_thread_command,
    // Message commands
    get_messages_command,
    // Chat commands
    chat_send_command,
    chat_stream_command,
    // Provider commands
    get_available_providers_command,
    // Request/Response types
    CreateThreadRequest,
    CreateThreadResponse,
    ChatRequest,
    ChatResponse,
    UpdateThreadRequest,
};
