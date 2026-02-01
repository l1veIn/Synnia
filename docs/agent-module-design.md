# Agent Module Design

> 基于 Rig.rs 的 Rust 后端 Agent 架构设计

## 开发阶段

- [x] Phase 1: 基础设施
- [x] Phase 2: 存储层
- [x] Phase 3: Provider 层
- [x] Phase 4: 模型注册
- [x] Phase 5: 状态管理
- [x] Phase 6: Agent Engine
- [x] Phase 7: Tauri Commands

## 概述

将 AI Agent 从前端迁移到 Rust 后端，实现：
- 更干净的代码结构
- 原生多步工具调用
- 更好的测试覆盖
- 统一的模型管理
- 支持流式/非流式输出

## 目录结构

```
src-tauri/src/features/agent/
├── mod.rs
├── commands/
│   ├── mod.rs
│   ├── chat.rs           # chat_send_message, chat_stream
│   ├── sessions.rs       # CRUD sessions
│   └── models.rs         # get_models, switch_model
├── providers/
│   ├── mod.rs
│   ├── registry.rs       # Provider 注册表
│   ├── google.rs         # Gemini
│   └── zhipu.rs          # 智谱 GLM
├── tools/
│   ├── mod.rs
│   ├── registry.rs
│   ├── nodes.rs
│   └── assets.rs
├── storage/
│   ├── mod.rs
│   ├── schema.sql
│   └── repository.rs
├── engine.rs
├── state.rs
└── types.rs
```

## 参考文件

| 模块 | 路径 |
|------|------|
| 模型类型定义 | `src/features/models/types.ts` |
| Provider 配置 | `src-tauri/src/features/settings/config.rs` |
| Settings 操作 | `src-tauri/src/features/settings/commands.rs` |
| 全局数据库 | `src-tauri/src/global/database.rs` (`get_global_db_path()`, `init_global_db()`) |
| 全局设置 | `src-tauri/src/global/settings.rs` |
| 测试项目 | `projects/test/` (含项目级 `synnia.db`) |

## 外部文档

| 文档 | 路径/链接 |
|------|-----------|
| Rig.rs 文档 | `docs/rig_doc.md` |
| Rig.rs 示例 | `docs/rig/rig/rig-core/examples/` |
| 智谱 OpenAI 兼容接口 | https://docs.bigmodel.cn/cn/guide/develop/openai/introduction.md |

### Rig 关键示例

| 示例文件 | 说明 |
|----------|------|
| `gemini_agent.rs` | Gemini Agent 基础使用 |
| `gemini_streaming.rs` | Gemini 流式输出 |
| `gemini_streaming_with_tools.rs` | Gemini 流式 + 工具调用 |
| `agent_with_tools.rs` | Agent 工具定义 |
| `agent_stream_chat.rs` | Agent 流式对话 |
| `multi_turn_agent.rs` | 多轮对话 |
| `multi_turn_streaming.rs` | 多轮流式对话 |
| `multi_turn_streaming_gemini.rs` | Gemini 多轮流式 |

## 核心依赖

```toml
rig-core = "0.24"
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rusqlite = { version = "0.32", features = ["bundled"] }
```

## ⚠️ 注意事项

> TEP 结晶审查发现的关键点

### 1. Zhipu Base URL 配置

智谱使用 OpenAI 兼容 API，需验证 Rig 的 `openai::Client` 是否支持自定义 `base_url`。

```rust
// 需要验证的写法
let client = openai::Client::from_url("https://open.bigmodel.cn/api/paas/v4/", &api_key);
```

若不支持，考虑：
- 使用 Rig 的 generic HTTP provider
- 直接用 `reqwest` 封装

### 2. Tool Context 注入

工具（如 `get_nodes_list`）需要访问项目数据库，但 Rig Tool trait 的 `call` 方法签名固定。

**解决方案**：通过闭包或 Context 注入 `project_path`

```rust
// 参考示例：docs/rig/rig/rig-core/examples/agent_with_context.rs
pub struct GetNodesListTool {
    project_path: String,  // 在构造时注入
}
```

### 3. 流式工具调用

流式输出时遇到 `tool_call` 的处理流程：

1. 收集完整的 `tool_call` JSON
2. 暂停流式输出
3. 执行工具
4. 继续流式输出后续内容

```rust
// 参考示例：docs/rig/rig/rig-core/examples/gemini_streaming_with_tools.rs
```

### 4. 错误类型

`types.rs` 应包含统一的错误类型：

```rust
#[derive(Debug, thiserror::Error)]
pub enum AgentError {
    #[error("Provider not configured: {0}")]
    ProviderNotConfigured(String),
    #[error("API key missing for: {0}")]
    ApiKeyMissing(String),
    #[error("Model not found: {0}")]
    ModelNotFound(String),
    #[error("LLM error: {0}")]
    LlmError(String),
    #[error("Database error: {0}")]
    DatabaseError(String),
}

## 配置复用

> ⚠️ API Keys 已存储在 `features/settings` 的 `ai_config` JSON blob，不重复定义

通过 `get_ai_config()` 读取已配置的 provider keys。

## 运行时状态

**History 和 Model 分离管理：**

```rust
// state.rs
pub struct ChatSession {
    pub session_id: String,
    pub history: Vec<Message>,        // 内存中的对话历史
    pub current_model: String,        // 当前模型（可中途切换）
    pub current_provider: String,
    pub prefer_streaming: bool,
}

pub struct AgentState {
    pub sessions: RwLock<HashMap<String, ChatSession>>,
}
```

## Provider 实现

目前只实现 **Google** 和 **Zhipu** 两种 provider：

```rust
// providers/registry.rs
pub enum ProviderClient {
    Google(google::Client),
    Zhipu(ZhipuClient),  // 使用 OpenAI 兼容接口
}

impl ProviderClient {
    pub fn from_settings(provider: &str) -> Result<Self, Error> {
        // 从 ai_config 读取 API key
        let api_key = get_api_key_from_settings(provider)?;
        
        match provider {
            "google" => Ok(Self::Google(google::Client::new(&api_key))),
            "zhipu" => Ok(Self::Zhipu(ZhipuClient::new(&api_key))),
            _ => Err(Error::UnsupportedProvider),
        }
    }
}
```

> 智谱使用 OpenAI 兼容 API，base_url: `https://open.bigmodel.cn/api/paas/v4/`

## 模型注册与过滤

> 参考：`src/features/models/types.ts`

`get_models` 命令根据以下条件过滤模型：
1. **Key 可用性** - 只返回已配置 key 的 provider 的模型
2. **能力匹配** - `chat`, `vision`, `function-calling`, `streaming` 等
3. **类别过滤** - `llm`, `image-generation`, `video-generation`

```rust
// commands/models.rs
#[tauri::command]
pub fn get_models(
    category: Option<String>,
    capabilities: Option<Vec<String>>,
) -> Result<Vec<ModelInfo>, String>
```

## 流式输出策略

1. 内存缓冲区收集 token
2. `app_handle.emit_all("agent:token")` 实时发送到前端
3. 流结束后一次性写入数据库
4. 模型不支持流式时自动 fallback 到非流式

```rust
// engine.rs
async fn run_stream_mode(&self, session: &ChatSession, app_handle: &AppHandle) {
    let mut buffer = String::new();
    
    while let Some(chunk) = stream.next().await {
        buffer.push_str(&chunk);
        app_handle.emit_all("agent:token", &chunk)?;
    }
    
    app_handle.emit_all("agent:complete", ())?;
    // 最后写入数据库
}
```

## 数据库 Schema

```sql
CREATE TABLE agent_sessions (
    id TEXT PRIMARY KEY,
    title TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_model_id TEXT,
    last_provider TEXT
);

CREATE TABLE agent_messages (
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
```

## Tauri Commands

```rust
// chat
chat_send_message(session_id, message, streaming?) -> AgentResponse
chat_switch_model(session_id, model, provider) -> ()

// models
get_models(category?, capabilities?) -> Vec<ModelInfo>

// sessions
get_sessions() -> Vec<SessionInfo>
delete_session(session_id) -> ()
```

### Phase 1: 基础设施

**目标**：创建目录结构和类型定义

**交付物**：
- `features/agent/mod.rs`
- `features/agent/types.rs` (ModelCategory, ModelCapability, ProviderType, ModelInfo)

**测试**：`cargo check` 编译通过

---

### Phase 2: 存储层

**目标**：实现对话持久化 CRUD

**交付物**：
- `storage/schema.sql`
- `storage/repository.rs` (create_session, save_message, load_messages, delete_session)

**测试**：
```rust
#[cfg(test)]
mod tests {
    // 使用内存 DB 测试 CRUD
    fn test_create_session() { /* ... */ }
    fn test_save_and_load_messages() { /* ... */ }
}
```

---

### Phase 3: Provider 层

**目标**：实现 Google 和 Zhipu client 创建

**交付物**：
- `providers/registry.rs` (ProviderClient enum)
- `providers/google.rs`
- `providers/zhipu.rs` (OpenAI 兼容)

**测试**：
```rust
#[test]
fn test_provider_from_settings() {
    // Mock ai_config JSON，验证 client 创建
}
```

---

### Phase 4: 模型注册

**目标**：实现模型列表和过滤查询

**交付物**：
- `providers/registry.rs` 中添加 ModelRegistry
- `commands/models.rs` (get_models)

**测试**：
```rust
#[test]
fn test_filter_by_capability() {
    // 验证 function-calling 过滤
}

#[test]
fn test_filter_unavailable_providers() {
    // 验证无 key 的 provider 被过滤
}
```

---

### Phase 5: 状态管理

**目标**：实现运行时会话状态

**交付物**：
- `state.rs` (ChatSession, AgentState)

**测试**：
```rust
#[tokio::test]
async fn test_concurrent_session_access() {
    // 多线程读写测试
}

#[tokio::test]
async fn test_switch_model_mid_conversation() {
    // 验证模型切换不影响历史
}
```

---

### Phase 6: Agent Engine

**目标**：实现核心对话引擎（流式/非流式）

**交付物**：
- `engine.rs` (AgentEngine, run, run_stream_mode, run_sync_mode)
- `tools/nodes.rs` (get_nodes_list)

**测试**：

```rust
// 单元测试（Mock）
#[test]
fn test_streaming_fallback() {
    // 验证不支持流式时自动降级
}

// 集成测试（真实 API，按需运行）
#[tokio::test]
#[ignore] // cargo test -- --ignored
async fn test_gemini_real_api() {
    // 从全局 DB 读取 Google key
    // 发送真实请求验证
}

#[tokio::test]
#[ignore]
async fn test_zhipu_real_api() {
    // 从全局 DB 读取 Zhipu key
    // 发送真实请求验证
}
```

---

### Phase 7: Tauri Commands

**目标**：暴露 API 给前端

**交付物**：
- `commands/chat.rs` (chat_send_message, chat_switch_model)
- `commands/sessions.rs` (get_sessions, delete_session)
- 注册到 `lib.rs`

**测试**：
- 编译通过
- 手动测试：前端调用 Tauri command

---

## 依赖关系

```
Phase 1 (基础设施)
    ↓
Phase 2 (存储层) ← Phase 3 (Provider 层)
          ↘         ↙
        Phase 4 (模型注册)
              ↓
        Phase 5 (状态管理)
              ↓
        Phase 6 (Agent Engine)
              ↓
        Phase 7 (Tauri Commands)
```

