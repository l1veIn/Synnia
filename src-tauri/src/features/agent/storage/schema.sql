-- Agent module database schema.
-- This schema will be created in Phase 2.

-- Sessions table
CREATE TABLE IF NOT EXISTS agent_sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_model_id TEXT,
    last_provider TEXT
);

-- Messages table
CREATE TABLE IF NOT EXISTS agent_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
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
