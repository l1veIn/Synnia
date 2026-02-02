# Agent 重实现 - 代码参考

> 本文档包含各文件的示例代码，供实现时参考

---

## 1. 数据库 Schema

```sql
-- 文件: src-tauri/src/features/agent_new/storage/schema.sql

-- 会话表
CREATE TABLE IF NOT EXISTS agent_threads (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'New Chat',
    model_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 消息表
CREATE TABLE IF NOT EXISTS agent_messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL,
    role TEXT NOT NULL,           -- 'user' | 'assistant'
    content TEXT NOT NULL,
    tool_calls TEXT,              -- JSON array (nullable)
    created_at TEXT NOT NULL,
    FOREIGN KEY (thread_id) REFERENCES agent_threads(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_agent_messages_thread ON agent_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_agent_threads_updated ON agent_threads(updated_at DESC);
```

---

## 2. Storage - 连接池模式

```rust
// storage/mod.rs

use once_cell::sync::Lazy;
use rusqlite::Connection;
use std::collections::HashMap;
use std::sync::Mutex;
use std::path::Path;

pub mod repository;

// 简易连接池: project_path -> Connection
static DB_POOL: Lazy<Mutex<HashMap<String, Connection>>> = 
    Lazy::new(|| Mutex::new(HashMap::new()));

/// 获取或创建数据库连接
pub fn get_connection(project_path: &str) -> Result<Connection, rusqlite::Error> {
    let db_path = Path::new(project_path).join("synnia.db");
    let db_path_str = db_path.to_string_lossy().to_string();
    
    // 注意: 简化实现，生产环境建议使用 r2d2 连接池
    let conn = Connection::open(&db_path)?;
    
    // 初始化 schema
    conn.execute_batch(include_str!("schema.sql"))?;
    
    Ok(conn)
}
```

---

## 3. Storage - Repository

```rust
// storage/repository.rs

use super::get_connection;
use rusqlite::params;

// ============================================================================
// Thread 操作
// ============================================================================

pub fn create_thread(
    project_path: &str, 
    model_id: &str, 
    provider: &str
) -> Result<String, rusqlite::Error> {
    let conn = get_connection(project_path)?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    
    conn.execute(
        "INSERT INTO agent_threads (id, title, model_id, provider, created_at, updated_at) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, "New Chat", model_id, provider, now, now],
    )?;
    
    Ok(id)
}

pub fn list_threads(project_path: &str) -> Result<Vec<ThreadInfo>, rusqlite::Error> {
    let conn = get_connection(project_path)?;
    let mut stmt = conn.prepare(
        "SELECT id, title, model_id, provider, created_at, updated_at 
         FROM agent_threads ORDER BY updated_at DESC"
    )?;
    
    let rows = stmt.query_map([], |row| {
        Ok(ThreadInfo {
            id: row.get(0)?,
            title: row.get(1)?,
            model_id: row.get(2)?,
            provider: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        })
    })?;
    
    rows.collect()
}

// ... 其他 CRUD 参考旧模块: agent/storage/repository.rs

// ============================================================================
// Message 操作  
// ============================================================================

pub fn save_message(
    project_path: &str,
    thread_id: &str,
    message_id: &str,
    role: &str,
    content: &str,
    tool_calls: Option<&str>,
) -> Result<(), rusqlite::Error> {
    let conn = get_connection(project_path)?;
    let now = chrono::Utc::now().to_rfc3339();
    
    conn.execute(
        "INSERT INTO agent_messages (id, thread_id, role, content, tool_calls, created_at) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![message_id, thread_id, role, content, tool_calls, now],
    )?;
    
    Ok(())
}

// 类型定义
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThreadInfo {
    pub id: String,
    pub title: String,
    pub model_id: String,
    pub provider: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageInfo {
    pub id: String,
    pub role: String,
    pub content: String,
    pub tool_calls: Option<String>,
    pub created_at: String,
}
```

---

## 4. Executor - StreamEvent

```rust
// executor.rs

/// 流式事件类型
/// SYNC: src/features/chat_new/types.ts
#[derive(Debug, Clone, serde::Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum StreamEvent {
    Token { text: String },
    ToolCall { id: String, name: String, args: String },
    ToolResult { id: String, name: String, result: String },
    Error { message: String },
    Complete,
}

/// 流式缓冲器 - 避免每个 token 都 emit
pub struct StreamBuffer {
    buffer: String,
    last_flush: std::time::Instant,
    flush_interval: std::time::Duration,
}

impl StreamBuffer {
    pub fn new() -> Self {
        Self {
            buffer: String::new(),
            last_flush: std::time::Instant::now(),
            flush_interval: std::time::Duration::from_millis(50),
        }
    }

    pub fn push(&mut self, text: &str) {
        self.buffer.push_str(text);
    }

    pub fn should_flush(&self) -> bool {
        self.last_flush.elapsed() >= self.flush_interval || self.buffer.len() > 100
    }

    pub fn flush(&mut self) -> Option<String> {
        if self.buffer.is_empty() {
            return None;
        }
        self.last_flush = std::time::Instant::now();
        Some(std::mem::take(&mut self.buffer))
    }
}
```

---

## 5. 前端 - BackendAdapter

```typescript
// BackendAdapter.ts

import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import type { ChatModelAdapter } from '@assistant-ui/react';
import type { StreamEvent } from './types';

export function createBackendAdapter(
  modelId: string,
  provider: string
): ChatModelAdapter {
  return {
    async *run({ messages, abortSignal }) {
      // 提取最后一条用户消息
      const lastMessage = messages[messages.length - 1];
      const textContent = lastMessage.content
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('');

      // 调用后端，立即返回 thread_id
      const threadId = await invoke<string>('agent_chat_stream', {
        threadId: undefined, // 或从上下文获取
        content: textContent,
        modelId,
        provider,
      });

      // 监听事件
      const eventName = `agent-stream-${threadId}`;
      
      // 按时间顺序追踪 content parts
      // 参考: chat/BackendChatModelAdapter.ts 的 chronological ordering 实现
      const contentParts: any[] = [];
      let currentTextIndex = -1;
      
      // ... 事件处理逻辑参考旧文件
    },
  };
}
```

---

## 6. 前端 - Types

```typescript
// types.ts
// SYNC: src-tauri/src/features/agent_new/executor.rs

export type StreamEvent =
  | { type: 'token'; text: string }
  | { type: 'toolCall'; id: string; name: string; args: string }
  | { type: 'toolResult'; id: string; name: string; result: string }
  | { type: 'error'; message: string }
  | { type: 'complete' };

export interface ThreadInfo {
  id: string;
  title: string;
  modelId: string;
  provider: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageInfo {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: string;
  createdAt: string;
}
```

---

## 7. 单元测试示例

```rust
// storage/repository.rs

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_create_and_list_threads() {
        let dir = tempdir().unwrap();
        let project_path = dir.path().to_str().unwrap();
        
        // 创建 thread
        let id = create_thread(project_path, "gemini-1.5-flash", "google").unwrap();
        assert!(!id.is_empty());
        
        // 列出 threads
        let threads = list_threads(project_path).unwrap();
        assert_eq!(threads.len(), 1);
        assert_eq!(threads[0].id, id);
    }

    #[test]
    fn test_save_and_get_messages() {
        let dir = tempdir().unwrap();
        let project_path = dir.path().to_str().unwrap();
        
        let thread_id = create_thread(project_path, "test", "test").unwrap();
        
        save_message(project_path, &thread_id, "msg1", "user", "Hello", None).unwrap();
        save_message(project_path, &thread_id, "msg2", "assistant", "Hi!", None).unwrap();
        
        let messages = get_messages(project_path, &thread_id).unwrap();
        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0].role, "user");
        assert_eq!(messages[1].role, "assistant");
    }
}
```

---

## 参考旧模块

| 功能 | 旧文件位置 |
|-----|-----------|
| Rig Agent 构建 | `agent/engine.rs:run_sync()` |
| 流式处理 | `agent/commands.rs:stream_chat_internal()` |
| 事件 emit | `agent/commands.rs:chat_stream()` |
| 工具实现 | `agent/tools/nodes.rs` |
| 前端适配器 | `chat/BackendChatModelAdapter.ts` |
| 持久化 | `chat/persistence/ThreadHistoryAdapter.ts` |
| **Provider 检查** | `agent/commands.rs:get_available_providers()` |

---

## 8. 流式/非流式 Fallback 实现

```rust
// executor.rs

impl AgentExecutor {
    /// Execute with streaming support check
    pub async fn execute<E: Emitter>(
        &self,
        emitter: &E,
        event_name: &str,
        thread_id: &str,
        user_message: &str,
        model_id: &str,
        provider: &str,
        supports_streaming: bool,  // 从前端传入
    ) -> Result<String, String> {
        if supports_streaming {
            self.execute_stream(emitter, event_name, thread_id, user_message, model_id, provider).await
        } else {
            self.execute_sync(emitter, event_name, thread_id, user_message, model_id, provider).await
        }
    }

    /// Non-streaming fallback: 调用同步 API 后一次性返回
    async fn execute_sync<E: Emitter>(
        &self,
        emitter: &E,
        event_name: &str,
        thread_id: &str,
        user_message: &str,
        model_id: &str,
        provider: &str,
    ) -> Result<String, String> {
        // 1. Save user message (WAL)
        // ...

        // 2. Call non-streaming API
        let response = agent.prompt(user_message).await?;

        // 3. Emit all at once
        emitter.emit(event_name, StreamEvent::Token { 
            text: response.content.clone() 
        }).ok();
        
        // 4. Save assistant message
        // ...

        emitter.emit(event_name, StreamEvent::Complete).ok();
        Ok(assistant_msg_id)
    }
}
```

---

## 9. get_available_providers 命令

```rust
// commands.rs

/// 返回已配置 API Key 的 Provider 列表
/// 前端用此过滤可用模型
#[tauri::command]
pub fn get_available_providers() -> Result<Vec<String>, String> {
    let mut available = vec![];

    // Google/Gemini
    if std::env::var("GOOGLE_API_KEY").is_ok() 
        || std::env::var("GEMINI_API_KEY").is_ok() {
        available.push("google".to_string());
    }

    // Zhipu
    if std::env::var("ZHIPU_API_KEY").is_ok() {
        available.push("zhipu".to_string());
    }

    // OpenAI
    if std::env::var("OPENAI_API_KEY").is_ok() {
        available.push("openai".to_string());
    }

    // Anthropic
    if std::env::var("ANTHROPIC_API_KEY").is_ok() {
        available.push("anthropic".to_string());
    }

    // DeepSeek
    if std::env::var("DEEPSEEK_API_KEY").is_ok() {
        available.push("deepseek".to_string());
    }

    // FAL
    if std::env::var("FAL_API_KEY").is_ok() {
        available.push("fal".to_string());
    }

    // Local providers (always available)
    available.push("ollama".to_string());
    available.push("lmstudio".to_string());
    available.push("g4f".to_string());

    Ok(available)
}
```

> **注意**: 此命令已在旧模块 `agent/commands.rs` 中实现，可直接参考或复用
