-- Agent storage schema for sessions and messages.
--
-- This schema stores AI agent chat sessions and messages in the global database.
-- Tables are created with IF NOT EXISTS to allow safe schema evolution.

-- Agent chat sessions
CREATE TABLE IF NOT EXISTS agent_sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_model_id TEXT,
    last_provider TEXT
);

-- Index for querying sessions by update time (most recent first)
CREATE INDEX IF NOT EXISTS idx_agent_sessions_updated
    ON agent_sessions(updated_at DESC);

-- Agent messages within a session
CREATE TABLE IF NOT EXISTS agent_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
    content TEXT,
    created_at INTEGER NOT NULL,
    model_id TEXT,
    provider TEXT,
    tool_call_id TEXT,
    tool_name TEXT,
    tool_args_json TEXT,
    tool_result_json TEXT,
    FOREIGN KEY(session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE
);

-- Index for loading messages in chronological order
CREATE INDEX IF NOT EXISTS idx_agent_messages_session
    ON agent_messages(session_id, created_at ASC);

-- Index for tool call lookups
CREATE INDEX IF NOT EXISTS idx_agent_messages_tool_call
    ON agent_messages(tool_call_id) WHERE tool_call_id IS NOT NULL;
