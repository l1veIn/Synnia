//! Runtime state management for agent sessions.
//!
//! This module provides in-memory session state for active chat sessions,
//! including message history, model selection, and streaming preferences.
//!
//! ## Architecture
//!
//! - [`ChatSession`] - Holds the state for a single chat session
//! - [`AgentState`] - Global container managing all active sessions
//!
//! ## Thread Safety
//!
//! [`AgentState`] uses [`RwLock`] to allow concurrent reads while writes
//! are exclusive. This enables multiple tasks to read session state
//! simultaneously while ensuring safe modifications.

use crate::features::agent::types::{Message, ProviderType};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use uuid::Uuid;

// ============================================================================
// Chat Session
// ============================================================================

/// Runtime state for a single chat session.
///
/// This struct holds the in-memory state of an active chat session,
/// including the conversation history and current model configuration.
///
/// # Fields
///
/// * `session_id` - Unique identifier for this session
/// * `title` - Human-readable session title
/// * `history` - In-memory message history (may diverge from DB during active chat)
/// * `current_model` - Currently selected model ID
/// * `current_provider` - Currently selected provider
/// * `prefer_streaming` - Whether to use streaming for responses
/// * `project_path` - Optional project context path for tools
#[derive(Debug, Clone)]
pub struct ChatSession {
    /// Unique session identifier
    pub session_id: String,
    /// Session title
    pub title: String,
    /// In-memory message history (may differ from persisted state during active chat)
    pub history: Vec<Message>,
    /// Current model ID (e.g., "gemini-2.5-flash")
    pub current_model: String,
    /// Current provider for this session
    pub current_provider: ProviderType,
    /// Whether to prefer streaming responses
    pub prefer_streaming: bool,
    /// Optional project path for context-aware tools
    pub project_path: Option<String>,
}

impl ChatSession {
    /// Create a new chat session.
    ///
    /// # Arguments
    ///
    /// * `title` - Session title
    /// * `model_id` - Initial model to use
    /// * `provider` - Initial provider
    /// * `prefer_streaming` - Whether to use streaming by default
    ///
    /// # Returns
    ///
    /// A new [`ChatSession`] with a unique ID and empty history.
    pub fn new(
        title: impl Into<String>,
        model_id: impl Into<String>,
        provider: ProviderType,
        prefer_streaming: bool,
    ) -> Self {
        Self {
            session_id: Uuid::new_v4().to_string(),
            title: title.into(),
            history: Vec::new(),
            current_model: model_id.into(),
            current_provider: provider,
            prefer_streaming,
            project_path: None,
        }
    }

    /// Create a new chat session with a specific ID.
    ///
    /// This is useful when restoring a session from the database.
    pub fn with_id(
        session_id: impl Into<String>,
        title: impl Into<String>,
        model_id: impl Into<String>,
        provider: ProviderType,
        prefer_streaming: bool,
    ) -> Self {
        Self {
            session_id: session_id.into(),
            title: title.into(),
            history: Vec::new(),
            current_model: model_id.into(),
            current_provider: provider,
            prefer_streaming,
            project_path: None,
        }
    }

    /// Create a new chat session with existing message history.
    ///
    /// This is useful when loading a session from the database.
    pub fn with_history(
        session_id: impl Into<String>,
        title: impl Into<String>,
        history: Vec<Message>,
        model_id: impl Into<String>,
        provider: ProviderType,
        prefer_streaming: bool,
    ) -> Self {
        Self {
            session_id: session_id.into(),
            title: title.into(),
            history,
            current_model: model_id.into(),
            current_provider: provider,
            prefer_streaming,
            project_path: None,
        }
    }

    /// Set the project path for this session.
    ///
    /// The project path is used by tools that need access to project-specific data.
    pub fn with_project_path(mut self, path: Option<String>) -> Self {
        self.project_path = path;
        self
    }

    /// Add a message to the session history.
    pub fn add_message(&mut self, message: Message) {
        self.history.push(message);
    }

    /// Add multiple messages to the session history.
    pub fn add_messages(&mut self, messages: Vec<Message>) {
        self.history.extend(messages);
    }

    /// Clear all messages from the session history.
    pub fn clear_history(&mut self) {
        self.history.clear();
    }

    /// Get the number of messages in the session history.
    pub fn message_count(&self) -> usize {
        self.history.len()
    }

    /// Switch to a different model.
    ///
    /// This does not affect the message history, only the model used for
    /// future responses.
    pub fn switch_model(&mut self, model_id: impl Into<String>, provider: ProviderType) {
        self.current_model = model_id.into();
        self.current_provider = provider;
    }

    /// Set whether to prefer streaming for responses.
    pub fn set_prefer_streaming(&mut self, prefer_streaming: bool) {
        self.prefer_streaming = prefer_streaming;
    }

    /// Get a reference to the last message, if any.
    pub fn last_message(&self) -> Option<&Message> {
        self.history.last()
    }

    /// Get a reference to the last user message, if any.
    pub fn last_user_message(&self) -> Option<&Message> {
        self.history
            .iter()
            .rev()
            .find(|m| m.role == crate::features::agent::types::MessageRole::User)
    }

    /// Check if the session has any messages.
    pub fn is_empty(&self) -> bool {
        self.history.is_empty()
    }
}

// ============================================================================
// Agent State
// ============================================================================

/// Global state container for all active chat sessions.
///
/// This struct manages the runtime state of all active chat sessions,
/// providing thread-safe access to session data using [`RwLock`].
///
/// # Thread Safety
///
/// The sessions map is wrapped in an [`Arc<RwLock<_>>`] to allow:
/// - Multiple concurrent readers (sessions can be read simultaneously)
/// - Exclusive writers (session modifications are atomic)
/// - Shared ownership across threads (Arc enables cloning the handle)
///
/// # Example
///
/// ```no_run
/// use crate::features::agent::state::{AgentState, ChatSession};
/// use crate::features::agent::types::ProviderType;
///
/// // Create the global state
/// let state = AgentState::new();
///
/// // Create a new session
/// let session = ChatSession::new(
///     "My Chat",
///     "gemini-2.5-flash",
///     ProviderType::Google,
///     true,
/// );
///
/// // Add the session to state
/// state.add_session(session);
///
/// // Retrieve the session later
/// let session = state.get_session(&session.session_id).unwrap();
/// ```
#[derive(Debug, Clone)]
pub struct AgentState {
    /// Thread-safe map of session ID to session state
    sessions: Arc<RwLock<HashMap<String, ChatSession>>>,
}

impl Default for AgentState {
    fn default() -> Self {
        Self::new()
    }
}

impl AgentState {
    /// Create a new, empty agent state.
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Add a session to the state.
    ///
    /// If a session with the same ID already exists, it will be replaced.
    ///
    /// # Arguments
    ///
    /// * `session` - The session to add
    pub fn add_session(&self, session: ChatSession) {
        let mut sessions = self.sessions.write().unwrap();
        sessions.insert(session.session_id.clone(), session);
    }

    /// Get a session by ID.
    ///
    /// # Arguments
    ///
    /// * `session_id` - The session ID to look up
    ///
    /// # Returns
    ///
    /// `Some(ChatSession)` if found, `None` otherwise
    pub fn get_session(&self, session_id: &str) -> Option<ChatSession> {
        let sessions = self.sessions.read().unwrap();
        sessions.get(session_id).cloned()
    }

    /// Remove a session from the state.
    ///
    /// # Arguments
    ///
    /// * `session_id` - The session ID to remove
    ///
    /// # Returns
    ///
    /// `Some(ChatSession)` if it was removed, `None` if it didn't exist
    pub fn remove_session(&self, session_id: &str) -> Option<ChatSession> {
        let mut sessions = self.sessions.write().unwrap();
        sessions.remove(session_id)
    }

    /// Check if a session exists in the state.
    ///
    /// # Arguments
    ///
    /// * `session_id` - The session ID to check
    pub fn has_session(&self, session_id: &str) -> bool {
        let sessions = self.sessions.read().unwrap();
        sessions.contains_key(session_id)
    }

    /// Get all active session IDs.
    ///
    /// # Returns
    ///
    /// A vector of all session IDs currently in the state.
    pub fn all_session_ids(&self) -> Vec<String> {
        let sessions = self.sessions.read().unwrap();
        sessions.keys().cloned().collect()
    }

    /// Get the number of active sessions.
    pub fn session_count(&self) -> usize {
        let sessions = self.sessions.read().unwrap();
        sessions.len()
    }

    /// Update a session in place.
    ///
    /// # Arguments
    ///
    /// * `session_id` - The session ID to update
    /// * `f` - A function that takes a mutable reference to the session
    ///
    /// # Returns
    ///
    /// `Ok(())` if the session was found and updated, `Err` otherwise
    pub fn update_session<F>(&self, session_id: &str, f: F) -> Result<(), SessionNotFoundError>
    where
        F: FnOnce(&mut ChatSession),
    {
        let mut sessions = self.sessions.write().unwrap();
        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| SessionNotFoundError(session_id.to_string()))?;
        f(session);
        Ok(())
    }

    /// Update or insert a session.
    ///
    /// If the session exists, it will be updated with the provided function.
    /// If it doesn't exist, a new session will be created using the provided function.
    ///
    /// # Arguments
    ///
    /// * `session_id` - The session ID to update or insert
    /// * `f` - A function that takes a mutable reference to the session (or new session)
    pub fn upsert_session<F>(&self, session_id: &str, f: F)
    where
        F: FnOnce(&mut ChatSession),
    {
        let mut sessions = self.sessions.write().unwrap();
        if let Some(session) = sessions.get_mut(session_id) {
            f(session);
        }
    }

    /// Add a message to a session's history.
    ///
    /// # Arguments
    ///
    /// * `session_id` - The session ID
    /// * `message` - The message to add
    ///
    /// # Returns
    ///
    /// `Ok(())` if successful, `Err` if the session doesn't exist
    pub fn add_message(
        &self,
        session_id: &str,
        message: Message,
    ) -> Result<(), SessionNotFoundError> {
        self.update_session(session_id, |session| {
            session.add_message(message);
        })
    }

    /// Switch the model for a session.
    ///
    /// # Arguments
    ///
    /// * `session_id` - The session ID
    /// * `model_id` - The new model ID
    /// * `provider` - The new provider
    ///
    /// # Returns
    ///
    /// `Ok(())` if successful, `Err` if the session doesn't exist
    pub fn switch_model(
        &self,
        session_id: &str,
        model_id: &str,
        provider: ProviderType,
    ) -> Result<(), SessionNotFoundError> {
        self.update_session(session_id, |session| {
            session.switch_model(model_id, provider);
        })
    }

    /// Clear all sessions from the state.
    pub fn clear_all(&self) {
        let mut sessions = self.sessions.write().unwrap();
        sessions.clear();
    }

    /// Get a clone of the inner Arc for sharing across threads.
    pub fn clone_inner(&self) -> Arc<RwLock<HashMap<String, ChatSession>>> {
        Arc::clone(&self.sessions)
    }
}

// ============================================================================
// Error Types
// ============================================================================

/// Error returned when a session is not found in the state.
///
/// This error indicates that the requested session ID does not exist
/// in the current agent state.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SessionNotFoundError(pub String);

impl std::fmt::Display for SessionNotFoundError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Session not found: {}", self.0)
    }
}

impl std::error::Error for SessionNotFoundError {}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::agent::types::{Message, MessageRole};

    fn create_test_message(content: &str, role: MessageRole) -> Message {
        Message {
            id: Uuid::new_v4().to_string(),
            role,
            content: content.to_string(),
            created_at: chrono::Utc::now().to_rfc3339(),
            model_id: None,
            provider: None,
            tool_call_id: None,
            tool_name: None,
            tool_args_json: None,
            tool_result_json: None,
        }
    }

    #[test]
    fn test_chat_session_new() {
        let session = ChatSession::new(
            "Test Session",
            "gemini-2.5-flash",
            ProviderType::Google,
            true,
        );

        assert!(!session.session_id.is_empty());
        assert_eq!(session.title, "Test Session");
        assert_eq!(session.current_model, "gemini-2.5-flash");
        assert_eq!(session.current_provider, ProviderType::Google);
        assert!(session.prefer_streaming);
        assert!(session.is_empty());
        assert!(session.project_path.is_none());
    }

    #[test]
    fn test_chat_session_with_id() {
        let session_id = "test-session-id";
        let session = ChatSession::with_id(
            session_id,
            "Test",
            "gemini-2.5-flash",
            ProviderType::Google,
            false,
        );

        assert_eq!(session.session_id, session_id);
        assert!(!session.prefer_streaming);
    }

    #[test]
    fn test_chat_session_with_history() {
        let history = vec![
            create_test_message("Hello", MessageRole::User),
            create_test_message("Hi there!", MessageRole::Assistant),
        ];

        let session = ChatSession::with_history(
            "test-id",
            "Test",
            history.clone(),
            "gemini-2.5-flash",
            ProviderType::Google,
            true,
        );

        assert_eq!(session.history.len(), 2);
        assert_eq!(session.message_count(), 2);
        assert!(!session.is_empty());
    }

    #[test]
    fn test_chat_session_add_message() {
        let mut session = ChatSession::new(
            "Test",
            "gemini-2.5-flash",
            ProviderType::Google,
            true,
        );

        assert!(session.is_empty());

        let msg = create_test_message("Test", MessageRole::User);
        session.add_message(msg);

        assert_eq!(session.message_count(), 1);
        assert!(!session.is_empty());
    }

    #[test]
    fn test_chat_session_add_messages() {
        let mut session = ChatSession::new(
            "Test",
            "gemini-2.5-flash",
            ProviderType::Google,
            true,
        );

        let messages = vec![
            create_test_message("Q1", MessageRole::User),
            create_test_message("A1", MessageRole::Assistant),
            create_test_message("Q2", MessageRole::User),
        ];

        session.add_messages(messages);

        assert_eq!(session.message_count(), 3);
    }

    #[test]
    fn test_chat_session_clear_history() {
        let mut session = ChatSession::new(
            "Test",
            "gemini-2.5-flash",
            ProviderType::Google,
            true,
        );

        session.add_message(create_test_message("Test", MessageRole::User));
        assert_eq!(session.message_count(), 1);

        session.clear_history();
        assert!(session.is_empty());
    }

    #[test]
    fn test_chat_session_switch_model() {
        let mut session = ChatSession::new(
            "Test",
            "gemini-2.5-flash",
            ProviderType::Google,
            true,
        );

        session.switch_model("glm-4.7", ProviderType::Zhipu);

        assert_eq!(session.current_model, "glm-4.7");
        assert_eq!(session.current_provider, ProviderType::Zhipu);
    }

    #[test]
    fn test_chat_session_set_prefer_streaming() {
        let mut session = ChatSession::new(
            "Test",
            "gemini-2.5-flash",
            ProviderType::Google,
            true,
        );

        assert!(session.prefer_streaming);

        session.set_prefer_streaming(false);
        assert!(!session.prefer_streaming);
    }

    #[test]
    fn test_chat_session_last_message() {
        let mut session = ChatSession::new(
            "Test",
            "gemini-2.5-flash",
            ProviderType::Google,
            true,
        );

        assert!(session.last_message().is_none());

        let msg1 = create_test_message("First", MessageRole::User);
        let msg2 = create_test_message("Second", MessageRole::Assistant);

        session.add_message(msg1);
        session.add_message(msg2);

        let last = session.last_message().unwrap();
        assert_eq!(last.content, "Second");
    }

    #[test]
    fn test_chat_session_last_user_message() {
        let mut session = ChatSession::new(
            "Test",
            "gemini-2.5-flash",
            ProviderType::Google,
            true,
        );

        session.add_message(create_test_message("User 1", MessageRole::User));
        session.add_message(create_test_message("Assistant", MessageRole::Assistant));
        session.add_message(create_test_message("User 2", MessageRole::User));

        let last_user = session.last_user_message().unwrap();
        assert_eq!(last_user.content, "User 2");
    }

    #[test]
    fn test_chat_session_with_project_path() {
        let session = ChatSession::new(
            "Test",
            "gemini-2.5-flash",
            ProviderType::Google,
            true,
        )
        .with_project_path(Some("/path/to/project".to_string()));

        assert_eq!(session.project_path, Some("/path/to/project".to_string()));
    }

    // AgentState tests

    #[test]
    fn test_agent_state_new() {
        let state = AgentState::new();
        assert_eq!(state.session_count(), 0);
        assert!(state.all_session_ids().is_empty());
    }

    #[test]
    fn test_agent_state_default() {
        let state = AgentState::default();
        assert_eq!(state.session_count(), 0);
    }

    #[test]
    fn test_agent_state_add_session() {
        let state = AgentState::new();
        let session = ChatSession::new(
            "Test",
            "gemini-2.5-flash",
            ProviderType::Google,
            true,
        );
        let session_id = session.session_id.clone();

        state.add_session(session);
        assert_eq!(state.session_count(), 1);
        assert!(state.has_session(&session_id));
    }

    #[test]
    fn test_agent_state_get_session() {
        let state = AgentState::new();
        let session = ChatSession::new(
            "Test",
            "gemini-2.5-flash",
            ProviderType::Google,
            true,
        );
        let id = session.session_id.clone();

        state.add_session(session);

        let retrieved = state.get_session(&id).unwrap();
        assert_eq!(retrieved.title, "Test");
        assert_eq!(retrieved.current_model, "gemini-2.5-flash");
    }

    #[test]
    fn test_agent_state_get_nonexistent_session() {
        let state = AgentState::new();
        assert!(state.get_session("nonexistent").is_none());
    }

    #[test]
    fn test_agent_state_remove_session() {
        let state = AgentState::new();
        let session = ChatSession::new(
            "Test",
            "gemini-2.5-flash",
            ProviderType::Google,
            true,
        );
        let id = session.session_id.clone();

        state.add_session(session);
        assert_eq!(state.session_count(), 1);

        let removed = state.remove_session(&id).unwrap();
        assert_eq!(removed.session_id, id);
        assert_eq!(state.session_count(), 0);
        assert!(!state.has_session(&id));
    }

    #[test]
    fn test_agent_state_remove_nonexistent_session() {
        let state = AgentState::new();
        assert!(state.remove_session("nonexistent").is_none());
    }

    #[test]
    fn test_agent_state_has_session() {
        let state = AgentState::new();
        let session = ChatSession::new(
            "Test",
            "gemini-2.5-flash",
            ProviderType::Google,
            true,
        );
        let session_id = session.session_id.clone();

        assert!(!state.has_session(&session_id));

        state.add_session(session);
        assert!(state.has_session(&session_id));
    }

    #[test]
    fn test_agent_state_all_session_ids() {
        let state = AgentState::new();
        let session1 = ChatSession::new(
            "Test 1",
            "gemini-2.5-flash",
            ProviderType::Google,
            true,
        );
        let session2 = ChatSession::new(
            "Test 2",
            "glm-4.7",
            ProviderType::Zhipu,
            false,
        );

        let id1 = session1.session_id.clone();
        let id2 = session2.session_id.clone();

        state.add_session(session1);
        state.add_session(session2);

        let ids = state.all_session_ids();
        assert_eq!(ids.len(), 2);
        assert!(ids.contains(&id1));
        assert!(ids.contains(&id2));
    }

    #[test]
    fn test_agent_state_update_session() {
        let state = AgentState::new();
        let session = ChatSession::new(
            "Original Title",
            "gemini-2.5-flash",
            ProviderType::Google,
            true,
        );
        let id = session.session_id.clone();

        state.add_session(session);

        // Update the session title
        let result = state.update_session(&id, |s| {
            s.title = "Updated Title".to_string();
        });

        assert!(result.is_ok());

        let updated = state.get_session(&id).unwrap();
        assert_eq!(updated.title, "Updated Title");
    }

    #[test]
    fn test_agent_state_update_nonexistent_session() {
        let state = AgentState::new();

        let result = state.update_session("nonexistent", |s| {
            s.title = "Updated".to_string();
        });

        assert!(result.is_err());
        assert_eq!(result.unwrap_err().0, "nonexistent");
    }

    #[test]
    fn test_agent_state_add_message() {
        let state = AgentState::new();
        let session = ChatSession::new(
            "Test",
            "gemini-2.5-flash",
            ProviderType::Google,
            true,
        );
        let id = session.session_id.clone();

        state.add_session(session);

        let msg = create_test_message("Hello", MessageRole::User);
        let result = state.add_message(&id, msg);

        assert!(result.is_ok());

        let retrieved = state.get_session(&id).unwrap();
        assert_eq!(retrieved.message_count(), 1);
    }

    #[test]
    fn test_agent_state_add_message_nonexistent_session() {
        let state = AgentState::new();
        let msg = create_test_message("Hello", MessageRole::User);

        let result = state.add_message("nonexistent", msg);
        assert!(result.is_err());
    }

    #[test]
    fn test_agent_state_switch_model() {
        let state = AgentState::new();
        let session = ChatSession::new(
            "Test",
            "gemini-2.5-flash",
            ProviderType::Google,
            true,
        );
        let id = session.session_id.clone();

        state.add_session(session);

        let result = state.switch_model(&id, "glm-4.7", ProviderType::Zhipu);
        assert!(result.is_ok());

        let retrieved = state.get_session(&id).unwrap();
        assert_eq!(retrieved.current_model, "glm-4.7");
        assert_eq!(retrieved.current_provider, ProviderType::Zhipu);
    }

    #[test]
    fn test_agent_state_switch_model_nonexistent_session() {
        let state = AgentState::new();
        let result = state.switch_model("nonexistent", "glm-4.7", ProviderType::Zhipu);
        assert!(result.is_err());
    }

    #[test]
    fn test_agent_state_clear_all() {
        let state = AgentState::new();

        state.add_session(ChatSession::new(
            "Test 1",
            "gemini-2.5-flash",
            ProviderType::Google,
            true,
        ));
        state.add_session(ChatSession::new(
            "Test 2",
            "glm-4.7",
            ProviderType::Zhipu,
            false,
        ));

        assert_eq!(state.session_count(), 2);

        state.clear_all();
        assert_eq!(state.session_count(), 0);
    }

    #[test]
    fn test_agent_state_clone_inner() {
        let state = AgentState::new();
        let session = ChatSession::new(
            "Test",
            "gemini-2.5-flash",
            ProviderType::Google,
            true,
        );
        let id = session.session_id.clone();

        state.add_session(session);

        let inner = state.clone_inner();
        let sessions = inner.read().unwrap();
        assert!(sessions.contains_key(&id));
    }

    // Concurrent access tests

    #[tokio::test]
    async fn test_concurrent_session_access() {
        let state = Arc::new(AgentState::new());
        let session = ChatSession::new(
            "Test",
            "gemini-2.5-flash",
            ProviderType::Google,
            true,
        );
        let session_id = session.session_id.clone();

        state.add_session(session);

        // Spawn multiple tasks that read from the state
        let mut handles = Vec::new();
        for i in 0..10 {
            let state_clone = Arc::clone(&state);
            let id = session_id.clone();
            let handle = tokio::spawn(async move {
                // Read the session
                let session = state_clone.get_session(&id);
                assert!(session.is_some());

                // Add a message with a delay
                let msg = create_test_message(
                    &format!("Message {}", i),
                    MessageRole::User,
                );
                state_clone.add_message(&id, msg).ok();

                // Read again
                let session = state_clone.get_session(&id);
                session.unwrap().message_count()
            });
            handles.push(handle);
        }

        // Wait for all tasks to complete
        let results: Vec<_> = futures::future::join_all(handles)
            .await
            .into_iter()
            .filter_map(|r| r.ok())
            .collect();

        // All tasks should have completed successfully
        assert_eq!(results.len(), 10);

        // The final session should have all 10 messages
        let final_session = state.get_session(&session_id).unwrap();
        assert_eq!(final_session.message_count(), 10);
    }

    #[tokio::test]
    async fn test_concurrent_different_sessions() {
        let state = Arc::new(AgentState::new());

        // Create multiple sessions
        let mut handles = Vec::new();
        for i in 0..5 {
            let state_clone = Arc::clone(&state);
            let handle = tokio::spawn(async move {
                let session = ChatSession::new(
                    format!("Session {}", i),
                    "gemini-2.5-flash",
                    ProviderType::Google,
                    true,
                );
                let id = session.session_id.clone();

                // Add the session
                state_clone.add_session(session);

                // Add a message
                let msg = create_test_message(
                    &format!("Message in session {}", i),
                    MessageRole::User,
                );
                state_clone.add_message(&id, msg).ok();

                id
            });
            handles.push(handle);
        }

        let ids: Vec<String> = futures::future::join_all(handles)
            .await
            .into_iter()
            .filter_map(|r| r.ok())
            .collect();

        // Verify all sessions were created with their messages
        assert_eq!(ids.len(), 5);
        assert_eq!(state.session_count(), 5);

        for id in &ids {
            let session = state.get_session(id).unwrap();
            assert_eq!(session.message_count(), 1);
        }
    }

    // Switch model mid-conversation tests

    #[tokio::test]
    async fn test_switch_model_mid_conversation() {
        let state = Arc::new(AgentState::new());
        let session = ChatSession::new(
            "Test",
            "gemini-2.5-flash",
            ProviderType::Google,
            true,
        );
        let session_id = session.session_id.clone();

        // Add some messages with Google model
        let msg1 = Message {
            id: Uuid::new_v4().to_string(),
            role: MessageRole::User,
            content: "Question 1".to_string(),
            created_at: chrono::Utc::now().to_rfc3339(),
            model_id: None,
            provider: None,
            tool_call_id: None,
            tool_name: None,
            tool_args_json: None,
            tool_result_json: None,
        };
        let msg2 = Message {
            id: Uuid::new_v4().to_string(),
            role: MessageRole::Assistant,
            content: "Answer 1".to_string(),
            created_at: chrono::Utc::now().to_rfc3339(),
            model_id: Some("gemini-2.5-flash".to_string()),
            provider: Some(ProviderType::Google),
            tool_call_id: None,
            tool_name: None,
            tool_args_json: None,
            tool_result_json: None,
        };

        state.add_session(session);
        state.add_message(&session_id, msg1).unwrap();
        state.add_message(&session_id, msg2).unwrap();

        // Verify initial state
        let session_before = state.get_session(&session_id).unwrap();
        assert_eq!(session_before.current_model, "gemini-2.5-flash");
        assert_eq!(session_before.current_provider, ProviderType::Google);
        assert_eq!(session_before.message_count(), 2);

        // Switch to Zhipu
        state
            .switch_model(&session_id, "glm-4.7", ProviderType::Zhipu)
            .unwrap();

        // Verify model changed but history is intact
        let session_after = state.get_session(&session_id).unwrap();
        assert_eq!(session_after.current_model, "glm-4.7");
        assert_eq!(session_after.current_provider, ProviderType::Zhipu);
        assert_eq!(session_after.message_count(), 2);
        assert_eq!(session_after.history[0].content, "Question 1");
        assert_eq!(session_after.history[1].content, "Answer 1");
    }

    #[tokio::test]
    async fn test_switch_model_during_active_conversation() {
        let state = Arc::new(AgentState::new());
        let session = ChatSession::new(
            "Test",
            "gemini-2.5-flash",
            ProviderType::Google,
            true,
        );
        let session_id = session.session_id.clone();

        state.add_session(session);

        // Simulate a conversation with model switches
        let mut handles = Vec::new();

        // Add first message with Google
        let state1 = Arc::clone(&state);
        let id1 = session_id.clone();
        let h1 = tokio::spawn(async move {
            let msg = create_test_message("Q with Google", MessageRole::User);
            state1.add_message(&id1, msg).ok();
        });
        handles.push(h1);

        // Switch to Zhipu
        let state2 = Arc::clone(&state);
        let id2 = session_id.clone();
        let h2 = tokio::spawn(async move {
            tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
            state2
                .switch_model(&id2, "glm-4.7", ProviderType::Zhipu)
                .ok();
        });
        handles.push(h2);

        // Add second message with Zhipu (after switch)
        let state3 = Arc::clone(&state);
        let id3 = session_id.clone();
        let h3 = tokio::spawn(async move {
            tokio::time::sleep(tokio::time::Duration::from_millis(20)).await;
            let msg = Message {
                id: Uuid::new_v4().to_string(),
                role: MessageRole::Assistant,
                content: "A from Zhipu".to_string(),
                created_at: chrono::Utc::now().to_rfc3339(),
                model_id: Some("glm-4.7".to_string()),
                provider: Some(ProviderType::Zhipu),
                tool_call_id: None,
                tool_name: None,
                tool_args_json: None,
                tool_result_json: None,
            };
            state3.add_message(&id3, msg).ok();
        });
        handles.push(h3);

        // Wait for all operations
        futures::future::join_all(handles).await;

        // Verify final state
        let final_session = state.get_session(&session_id).unwrap();
        assert_eq!(final_session.current_model, "glm-4.7");
        assert_eq!(final_session.current_provider, ProviderType::Zhipu);
        assert_eq!(final_session.message_count(), 2);
        assert_eq!(final_session.history[0].content, "Q with Google");
        assert_eq!(final_session.history[1].content, "A from Zhipu");
    }

    #[test]
    fn test_session_not_found_error_display() {
        let err = SessionNotFoundError("test-id".to_string());
        assert_eq!(format!("{}", err), "Session not found: test-id");
    }

    #[test]
    fn test_session_not_found_error_debug() {
        let err = SessionNotFoundError("test-id".to_string());
        assert_eq!(format!("{:?}", err), "SessionNotFoundError(\"test-id\")");
    }
}
