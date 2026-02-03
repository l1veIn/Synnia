-- Schema for agent module
-- Tables: agent_threads, agent_messages

-- Thread (conversation) table
CREATE TABLE IF NOT EXISTS agent_threads (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'New Chat',
    model_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Message table
CREATE TABLE IF NOT EXISTS agent_messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content_json TEXT NOT NULL,
    model_id TEXT,
    provider TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (thread_id) REFERENCES agent_threads(id) ON DELETE CASCADE
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_agent_messages_thread ON agent_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_agent_threads_updated ON agent_threads(updated_at DESC);
