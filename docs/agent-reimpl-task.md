# Agent/Chat 模块重实现任务

> **版本:** 1.0  
> **目标:** 创建 `agent_new` (后端) 和 `chat_new` (前端) 精简模块  
> **范围:** 仅实现 + 单元测试，不接入系统

---

## 任务概述

基于 TEP 结晶架构，重新实现最精简的 Agent 聊天模块。

**核心原则:**
1. **后端驱动**: 所有 AI 执行和持久化在 Rust
2. **WAL 即时持久化**: 每条消息即时写入
3. **数据库连接池**: 避免重复连接开销
4. **事件流缓冲**: 流式输出使用缓冲
5. **流式/非流式 Fallback**: 对不支持流式的模型自动降级

---

## 模型与 Provider 架构

> ⚠️ **关键知识**: 模型注册在前端，Provider 注册在后端

### 前端模型注册 (已实现)
- 位置: `src/features/models/`
- 类型定义: `src/features/models/types.ts`
- 注册逻辑: `src/features/models/index.ts`

**ModelPlugin 关键字段:**
```typescript
interface ModelPlugin {
  id: string;
  provider: ProviderType;
  capabilities?: ModelCapability[];  // 包含 'streaming' 表示支持流式
  // ...
}
```

### 后端 Provider 注册
- 后端负责检查哪些 Provider 有配置 API Key
- 需实现 `get_available_providers` 命令
- 前端调用此命令过滤可用模型

### 数据流
```
前端模型注册表 (ModelPlugin[])
        ↓ 调用 get_available_providers
后端检查 API Key 配置
        ↓ 返回 ["google", "zhipu", ...]
前端过滤: 只显示有配置的 Provider 的模型
```

> ⚠️ **重要**: 实现过程中请随时参考旧模块 `src-tauri/src/features/agent/` 和 `src/features/chat/` 作为参考

---

## 任务列表

- [x] Phase 1: 后端基础设施 (预计 30分钟)
-  创建 `src-tauri/src/features/agent_new/` 目录结构
-  实现 `storage/mod.rs` + `storage/repository.rs` (带连接池)
-  添加 schema.sql (表名: `agent_threads`, `agent_messages`)
-  编写 storage 单元测试

- [x] Phase 2: Provider 层 (预计 15分钟)
-  实现 `providers/mod.rs` (Provider 工厂)
-  实现 `providers/gemini.rs` (Gemini 配置)
-  编写 provider 单元测试 (Mock 或跳过 API 调用)

- [x] Phase 3: 工具层 (预计 20分钟)
-  实现 `tools/mod.rs` (工具注册表)
-  实现 `tools/get_nodes.rs` (GetNodesList 工具)
-  编写工具单元测试

- [x] Phase 4: 执行器 (预计 40分钟)
-  实现 `executor.rs` (StreamEvent + AgentExecutor)
-  实现流式输出缓冲机制
-  实现**流式/非流式 Fallback**: 
  - 接收 `supports_streaming: bool` 参数
  - 对不支持流式的模型，调用非流式 API 后一次性返回
-  编写执行器单元测试

- [x] Phase 5: Tauri 命令 (预计 25分钟)
-  实现 `commands.rs` (所有 Tauri 命令)
-  实现 `mod.rs` (模块导出)
-  实现 `get_available_providers` 命令 (返回有 API Key 配置的 Provider 列表)
-  编写命令单元测试

- [x] Phase 6: 前端模块 (预计 30分钟)
-  创建 `src/features/chat_new/` 目录结构
-  实现 `types.ts` (与后端 StreamEvent 同步)
-  实现 `BackendAdapter.ts` (chronological content ordering)
-  实现 `PersistenceAdapter.ts` (调用后端命令)
-  实现 `ChatProvider.tsx` (Runtime 整合)
-  实现 `tools/ToolUIRegistry.tsx` (ToolUI 组件)
-  验证 TypeScript 编译通过

---

## 文件结构

### 后端 (7 文件)
```
src-tauri/src/features/agent_new/
├── mod.rs               # 模块导出
├── commands.rs          # Tauri 命令入口
├── executor.rs          # Agent 执行器 + StreamEvent
├── tools/
│   ├── mod.rs           # 工具注册表
│   └── get_nodes.rs     # GetNodesList 工具
├── providers/
│   ├── mod.rs           # Provider 工厂
│   └── gemini.rs        # Gemini 配置
└── storage/
    ├── mod.rs           # 存储导出
    ├── schema.sql       # 数据库 Schema
    └── repository.rs    # Thread + Message CRUD
```

### 前端 (6 文件)
```
src/features/chat_new/
├── index.ts             # 模块导出
├── types.ts             # 类型定义 (同步后端)
├── ChatProvider.tsx     # Runtime 整合
├── BackendAdapter.ts    # Tauri events → assistant-ui
├── PersistenceAdapter.ts # 后端持久化调用
└── tools/
    └── ToolUIRegistry.tsx # ToolUI 组件注册
```

---

## 关键设计要点

### 1. 数据库连接池
**问题**: 每次操作都 `Connection::open()` 开销大  
**方案**: 使用 `once_cell::sync::Lazy` 或 `r2d2` 连接池

```rust
// 参考实现思路
use once_cell::sync::Lazy;
use std::sync::Mutex;
use std::collections::HashMap;

static DB_POOL: Lazy<Mutex<HashMap<String, Connection>>> = Lazy::new(|| Mutex::new(HashMap::new()));

fn get_connection(project_path: &str) -> Result<Connection, Error> {
    // 从池中获取或创建新连接
}
```

### 2. 流式输出缓冲
**问题**: 每个 token 立即 emit 可能造成前端卡顿  
**方案**: 使用缓冲 + 定时刷新 (如每 50ms 或每 5 个 token)

### 3. 新表名 (避免冲突)
- `agent_threads` (替代 `chat_sessions`)
- `agent_messages` (替代 `session_messages`)

### 4. 参考旧模块
| 新文件 | 参考旧文件 |
|--------|-----------|
| `executor.rs` | `agent/engine.rs`, `agent/commands.rs:stream_chat_internal` |
| `commands.rs` | `agent/commands.rs` |
| `storage/repository.rs` | `agent/storage/repository.rs`, `chat/session_repository.rs` |
| `tools/get_nodes.rs` | `agent/tools/nodes.rs` |
| `BackendAdapter.ts` | `chat/BackendChatModelAdapter.ts` |

---

## 验证标准

### 后端
```bash
cd src-tauri
cargo test --lib features::agent_new
```

### 前端
```bash
pnpm tsc --noEmit
```

---

## 代码参考

详细示例代码见: [agent-reimpl-code-reference.md](./agent-reimpl-code-reference.md)

---

## 注意事项

1. **不要删除旧模块**: `agent` 和 `chat` 保持不变
2. **不需要接入系统**: 仅实现模块 + 单元测试
3. **参考旧代码**: 旧模块包含很多可复用的逻辑
4. **类型同步**: 后端 `StreamEvent` 和前端 `types.ts` 需手动保持一致
