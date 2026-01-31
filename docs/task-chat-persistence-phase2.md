# 任务：Chat 持久化 - Phase 2 (JSON 文件方案)

## 目标

实现基于 JSON 文件的聊天记录持久化，支持多会话管理。

**Phase 2 范围：**
- ✅ JSON 文件持久化（index + threads）
- ✅ 会话增删改查
- ✅ 与 assistant-ui 的 ThreadListAdapter 集成
- ❌ 消息内容搜索（不需要）
- ❌ 自动标题生成（可选，后续实现）

## 必读参考 Skills

实现前**必须**阅读以下 skills：

- `.agents/skills/runtime/SKILL.md` - Runtime 系统和状态管理
  - `.agents/skills/runtime/references/thread-list.md` - **重点**：`useRemoteThreadListRuntime` 和 `RemoteThreadListAdapter` 的完整 API
  - `.agents/skills/runtime/references/local-runtime.md` - `useLocalRuntime` 和 `ThreadHistoryAdapter`
- `.agents/skills/thread-list/SKILL.md` - Thread List 管理
  - `.agents/skills/thread-list/references/management.md` - CRUD 操作 API

## 存储结构

**重要**：聊天记录存储在**项目目录**下，而不是全局 `~/.synnia/`：

```
{projectDir}/chat/
├── index.json              # 会话索引（元数据列表）
└── threads/
    ├── {threadId}.json     # 单个会话完整内容
    └── ...
```

例如：`/Users/yangchen/Documents/SynniaProjects/test/chat/`

**原因**：每个项目的聊天记录应该独立，不混在一起。

### index.json 结构

```typescript
interface ChatIndex {
  version: 1;
  threads: ThreadMetadata[];
}

interface ThreadMetadata {
  id: string;                  // UUID
  title: string;               // 会话标题
  createdAt: string;           // ISO 8601
  updatedAt: string;           // ISO 8601
  isArchived: boolean;         // 是否归档
  messageCount: number;        // 消息数量
  lastMessage?: string;        // 最后一条消息预览（前 100 字符）
  modelId?: string;            // 使用的模型
}
```

### {threadId}.json 结构

```typescript
interface ThreadData {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  modelId?: string;
  messages: ThreadMessage[];   // assistant-ui 的消息格式
}

// ThreadMessage 使用 assistant-ui 的类型
// 来自 @assistant-ui/react
```

## 实现架构

```
src/features/chat/
├── index.ts
├── ChatRuntimeProvider.tsx    # 已有
├── useChatModelAdapter.ts     # 已有
├── useChatModelSelector.ts    # 已有
│
├── persistence/               # 新增：持久化模块
│   ├── index.ts
│   ├── types.ts               # ChatIndex, ThreadMetadata, ThreadData
│   ├── storage.ts             # 底层文件读写（Tauri fs API）
│   ├── ChatThreadListAdapter.ts  # RemoteThreadListAdapter 实现
│   └── usePersistentRuntime.ts   # 包装 useLocalRuntime + 持久化
```

## 核心实现

### 1. 后端：src-tauri/src/features/chat/

参考现有模块结构（如 `features/history/`）创建 chat 模块：

```
src-tauri/src/features/
├── chat/                  # 新增
│   ├── mod.rs            # pub mod commands; pub mod types; pub use commands::*;
│   ├── commands.rs       # Tauri commands
│   └── types.rs          # ChatIndex, ThreadData, ThreadMetadata
└── mod.rs                # 更新：pub mod chat;
```

#### types.rs

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatIndex {
    pub version: u32,
    pub threads: Vec<ThreadMetadata>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadMetadata {
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
    pub is_archived: bool,
    pub message_count: u32,
    pub last_message: Option<String>,
    pub model_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadData {
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
    pub model_id: Option<String>,
    pub messages: Vec<serde_json::Value>, // assistant-ui 消息格式
}

impl Default for ChatIndex {
    fn default() -> Self {
        Self { version: 1, threads: vec![] }
    }
}
```

#### commands.rs

**关键**：使用当前项目路径，而不是全局 app_data_dir：

```rust
use tauri::{AppHandle, Manager, State};
use std::fs;
use std::path::PathBuf;
use super::types::{ChatIndex, ThreadData, ThreadMetadata};
use crate::core::AppState;

/// 获取当前项目的 chat 目录
/// 路径：{projectDir}/chat/
fn get_chat_dir(state: &State<AppState>) -> Result<PathBuf, String> {
    let project_path = state.current_project_path.lock()
        .map_err(|e| format!("Failed to lock project path: {}", e))?;
    
    let project_dir = project_path
        .as_ref()
        .ok_or("No project is currently open")?;
    
    Ok(PathBuf::from(project_dir).join("chat"))
}

fn ensure_chat_dir(state: &State<AppState>) -> Result<PathBuf, String> {
    let chat_dir = get_chat_dir(state)?;
    let threads_dir = chat_dir.join("threads");
    
    if !chat_dir.exists() {
        fs::create_dir_all(&chat_dir).map_err(|e| e.to_string())?;
    }
    if !threads_dir.exists() {
        fs::create_dir_all(&threads_dir).map_err(|e| e.to_string())?;
    }
    
    Ok(chat_dir)
}

#[tauri::command]
pub async fn chat_get_index(state: State<'_, AppState>) -> Result<ChatIndex, String> {
    let chat_dir = ensure_chat_dir(&state)?;
    let index_path = chat_dir.join("index.json");
    
    if !index_path.exists() {
        return Ok(ChatIndex::default());
    }
    
    let content = fs::read_to_string(&index_path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn chat_save_index(state: State<'_, AppState>, index: ChatIndex) -> Result<(), String> {
    let chat_dir = ensure_chat_dir(&state)?;
    let index_path = chat_dir.join("index.json");
    
    let content = serde_json::to_string_pretty(&index).map_err(|e| e.to_string())?;
    
    // Atomic write: temp file + rename
    let temp_path = index_path.with_extension("json.tmp");
    fs::write(&temp_path, &content).map_err(|e| e.to_string())?;
    fs::rename(&temp_path, &index_path).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub async fn chat_get_thread(state: State<'_, AppState>, thread_id: String) -> Result<Option<ThreadData>, String> {
    let chat_dir = get_chat_dir(&state)?;
    let thread_path = chat_dir.join("threads").join(format!("{}.json", thread_id));
    
    if !thread_path.exists() {
        return Ok(None);
    }
    
    let content = fs::read_to_string(&thread_path).map_err(|e| e.to_string())?;
    let thread = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(Some(thread))
}

#[tauri::command]
pub async fn chat_save_thread(state: State<'_, AppState>, thread: ThreadData) -> Result<(), String> {
    let chat_dir = ensure_chat_dir(&state)?;
    let thread_path = chat_dir.join("threads").join(format!("{}.json", &thread.id));
    
    let content = serde_json::to_string_pretty(&thread).map_err(|e| e.to_string())?;
    
    // Atomic write
    let temp_path = thread_path.with_extension("json.tmp");
    fs::write(&temp_path, &content).map_err(|e| e.to_string())?;
    fs::rename(&temp_path, &thread_path).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub async fn chat_delete_thread(state: State<'_, AppState>, thread_id: String) -> Result<(), String> {
    let chat_dir = get_chat_dir(&state)?;
    let thread_path = chat_dir.join("threads").join(format!("{}.json", thread_id));
    
    if thread_path.exists() {
        fs::remove_file(&thread_path).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}
```

#### 注册 Commands

在 `src-tauri/src/lib.rs` 中注册：

```rust
// 添加导入
use features::chat;

// 在 invoke_handler 中添加
.invoke_handler(tauri::generate_handler![
    // ... 现有 commands ...
    chat::chat_get_index,
    chat::chat_save_index,
    chat::chat_get_thread,
    chat::chat_save_thread,
    chat::chat_delete_thread,
])
```

### 2. 前端：storage.ts（调用后端 Commands）

使用 Tauri 的 `invoke` 调用后端：

```typescript
import { invoke } from '@tauri-apps/api/core';
import type { ChatIndex, ThreadData } from './types';

export async function readIndex(): Promise<ChatIndex> {
  return await invoke('chat_get_index');
}

export async function writeIndex(index: ChatIndex): Promise<void> {
  await invoke('chat_save_index', { index });
}

export async function readThread(threadId: string): Promise<ThreadData | null> {
  return await invoke('chat_get_thread', { threadId });
}

export async function writeThread(thread: ThreadData): Promise<void> {
  await invoke('chat_save_thread', { thread });
}

export async function deleteThread(threadId: string): Promise<void> {
  await invoke('chat_delete_thread', { threadId });
}
```

### 2. ChatThreadListAdapter.ts

实现 assistant-ui 的 `RemoteThreadListAdapter`:

```typescript
import type { 
  unstable_RemoteThreadListAdapter as RemoteThreadListAdapter 
} from '@assistant-ui/react';
import { readIndex, writeIndex, readThread, writeThread, deleteThread } from './storage';
import { v4 as uuidv4 } from 'uuid';

export function createChatThreadListAdapter(): RemoteThreadListAdapter {
  return {
    // 列出所有会话
    async list() {
      const index = await readIndex();
      return {
        threads: index.threads.map(t => ({
          remoteId: t.id,
          status: t.isArchived ? 'archived' : 'regular',
          title: t.title,
        })),
      };
    },

    // 创建新会话
    async initialize(localId: string) {
      const id = uuidv4();
      const now = new Date().toISOString();
      
      // 创建 thread 文件
      const thread: ThreadData = {
        id,
        title: 'New Chat',
        createdAt: now,
        updatedAt: now,
        messages: [],
      };
      await writeThread(thread);
      
      // 更新 index
      const index = await readIndex();
      index.threads.unshift({
        id,
        title: 'New Chat',
        createdAt: now,
        updatedAt: now,
        isArchived: false,
        messageCount: 0,
      });
      await writeIndex(index);
      
      return { remoteId: id };
    },

    // 重命名
    async rename(remoteId: string, title: string) {
      const index = await readIndex();
      const threadMeta = index.threads.find(t => t.id === remoteId);
      if (threadMeta) {
        threadMeta.title = title;
        threadMeta.updatedAt = new Date().toISOString();
        await writeIndex(index);
      }
      
      const thread = await readThread(remoteId);
      if (thread) {
        thread.title = title;
        thread.updatedAt = new Date().toISOString();
        await writeThread(thread);
      }
    },

    // 归档
    async archive(remoteId: string) {
      const index = await readIndex();
      const threadMeta = index.threads.find(t => t.id === remoteId);
      if (threadMeta) {
        threadMeta.isArchived = true;
        threadMeta.updatedAt = new Date().toISOString();
        await writeIndex(index);
      }
    },

    // 取消归档
    async unarchive(remoteId: string) {
      const index = await readIndex();
      const threadMeta = index.threads.find(t => t.id === remoteId);
      if (threadMeta) {
        threadMeta.isArchived = false;
        threadMeta.updatedAt = new Date().toISOString();
        await writeIndex(index);
      }
    },

    // 删除
    async delete(remoteId: string) {
      // 删除文件
      await deleteThread(remoteId);
      
      // 更新 index
      const index = await readIndex();
      index.threads = index.threads.filter(t => t.id !== remoteId);
      await writeIndex(index);
    },

    // 获取会话详情
    async fetch(remoteId: string) {
      const index = await readIndex();
      const threadMeta = index.threads.find(t => t.id === remoteId);
      
      return {
        remoteId,
        status: threadMeta?.isArchived ? 'archived' : 'regular',
        title: threadMeta?.title || 'Chat',
      };
    },

    // 生成标题（简单实现：取第一条消息前 30 字符）
    async generateTitle(remoteId: string, messages: readonly any[]) {
      // 简单实现：不调用 AI，直接用第一条用户消息
      const firstUserMessage = messages.find(m => m.role === 'user');
      let title = 'New Chat';
      
      if (firstUserMessage) {
        const textContent = firstUserMessage.content
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text)
          .join('');
        title = textContent.slice(0, 30) + (textContent.length > 30 ? '...' : '');
      }
      
      // 返回一个简单的 ReadableStream
      return new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(title));
          controller.close();
        }
      });
    },
  };
}
```

### 3. ThreadHistoryAdapter - 消息持久化

使用 assistant-ui 的 `ThreadHistoryAdapter` 来保存消息：

```typescript
import type { ThreadHistoryAdapter } from '@assistant-ui/react';

export function createThreadHistoryAdapter(threadId: string): ThreadHistoryAdapter {
  return {
    // 加载历史消息
    async load() {
      const thread = await readThread(threadId);
      return thread?.messages || [];
    },

    // 追加消息（消息完成后调用）
    async append(message) {
      const thread = await readThread(threadId);
      if (!thread) return;
      
      thread.messages.push(message);
      thread.updatedAt = new Date().toISOString();
      await writeThread(thread);
      
      // 更新 index 中的 messageCount 和 lastMessage
      const index = await readIndex();
      const meta = index.threads.find(t => t.id === threadId);
      if (meta) {
        meta.messageCount = thread.messages.length;
        meta.updatedAt = thread.updatedAt;
        
        // 更新最后消息预览
        const lastContent = message.content
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text)
          .join('');
        meta.lastMessage = lastContent.slice(0, 100);
        
        await writeIndex(index);
      }
    },
  };
}
```

### 4. 更新 ChatRuntimeProvider

集成持久化功能：

```typescript
import { 
  AssistantRuntimeProvider, 
  useLocalRuntime,
  unstable_useRemoteThreadListRuntime as useRemoteThreadListRuntime,
} from '@assistant-ui/react';
import { createChatThreadListAdapter } from './persistence/ChatThreadListAdapter';
import { useChatModelAdapter } from './useChatModelAdapter';

export function ChatRuntimeProvider({ children }: { children: ReactNode }) {
  const modelAdapter = useChatModelAdapter();
  const threadListAdapter = useMemo(() => createChatThreadListAdapter(), []);
  
  const runtime = useRemoteThreadListRuntime({
    runtimeHook: () => useLocalRuntime(modelAdapter),
    adapter: threadListAdapter,
  });
  
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
```

## 边界访问逻辑

### 0. 「当前会话」概念

**定义**：用户最后选中并停留的会话就是「当前会话」。

**存储**：当前会话 ID 存储在 `localStorage`（每个项目独立 key）：

```typescript
// 使用项目 ID 作为 key 的一部分，确保每个项目有独立的当前会话
const STORAGE_KEY = `synnia-chat-lastActiveThread-${projectId}`;

// 保存当前会话
localStorage.setItem(STORAGE_KEY, threadId);

// 读取当前会话
const lastThreadId = localStorage.getItem(STORAGE_KEY);
```

**行为**：
- ✅ 切换会话时，立即更新 localStorage
- ✅ 再次打开聊天框时，自动恢复到当前会话
- ✅ 删除当前会话后，清除缓存并切换到下一个会话
- ❌ 不需要后端参与，纯前端缓存

### 1. 启动加载逻辑

```
Canvas 组件挂载
    ↓
ChatRuntimeProvider 初始化
    ↓
读取 index.json（一次性）
    ↓
读取 localStorage 获取 lastActiveThreadId
    ↓
如果 lastActiveThreadId 存在且有效 → 自动加载该会话
如果 lastActiveThreadId 无效或不存在 → 加载最近一个（updatedAt 最新）
如果没有任何会话 → 显示初始引导界面（Welcome）
```

**实现要点：**
- `index.json` 在 Provider 初始化时读取一次，缓存在内存中
- 优先使用 localStorage 中的 `lastActiveThreadId`
- 如果 `lastActiveThreadId` 对应的会话已被删除，则 fallback 到 `threads[0]`
- Thread 消息在选中时才从文件加载

**切换会话时更新缓存：**

```typescript
// 在 useRemoteThreadListRuntime 的 onSwitchThread 或类似回调中
useEffect(() => {
  const unsubscribe = runtime.subscribe(() => {
    const { mainThreadId } = runtime.getState().threadList;
    if (mainThreadId) {
      localStorage.setItem(STORAGE_KEY, mainThreadId);
    }
  });
  return unsubscribe;
}, [runtime]);
```

### 2. 显示/隐藏聊天框（不触发 IO）

```tsx
// Canvas.tsx 当前实现
const [isModalOpen, setIsModalOpen] = useState(false);

// Modal 和 Fullscreen 只是 CSS 显示/隐藏
{!isFullscreen && <AssistantModal isOpen={isModalOpen} ... />}
<AssistantFullscreen isOpen={isFullscreen} ... />
```

**关键规则：**
- ✅ Modal/Fullscreen **始终挂载**，通过 `isOpen` 控制可见性
- ✅ ChatRuntimeProvider **始终挂载**，保持状态
- ❌ **不要** 在隐藏时卸载组件（否则会丢失状态）
- ❌ **不要** 在显示/隐藏时触发读写

**UI 组件实现：**
```tsx
// AssistantModal.tsx
export function AssistantModal({ isOpen, ... }) {
  if (!isOpen) return null;  // 或者用 CSS visibility/display
  // ...
}
```

### 3. 删除历史后的状态

```
用户删除当前会话
    ↓
从 index.threads 移除
    ↓
如果还有其他会话 → 切换到最近的会话
如果没有会话了 → 显示初始引导界面（Welcome）
```

**实现要点：**
```typescript
// ChatThreadListAdapter.ts
async delete(remoteId: string) {
  await deleteThread(remoteId);
  
  const index = await readIndex();
  index.threads = index.threads.filter(t => t.id !== remoteId);
  await writeIndex(index);
  
  // assistant-ui 会自动处理 UI 状态切换
  // 如果删除的是当前会话，会触发 switchToThread 或显示空状态
}
```

### 4. 懒创建会话（发送第一条消息才创建）

```
用户打开聊天框（无会话）
    ↓
显示初始引导界面 + 空输入框
    ↓
用户输入并发送消息
    ↓
调用 initialize() 创建会话
    ↓
将消息追加到新会话
```

**关键规则：**
- ✅ 引导界面是 **临时状态**，不创建任何文件
- ✅ `initialize()` 在用户发送第一条消息时才调用
- ✅ assistant-ui 的 `useRemoteThreadListRuntime` 已内置此逻辑

**assistant-ui 的行为：**
```
Thread 状态: "new" (临时) → "regular" (持久化)

"new" 状态:
  - 没有 remoteId
  - 消息只在内存中
  - 不调用 adapter.initialize()

用户发送消息后:
  - 调用 adapter.initialize()
  - 获取 remoteId
  - 调用 historyAdapter.append() 保存消息
  - 状态变为 "regular"
```

### 5. IO 优化策略

| 操作 | 触发 IO | 说明 |
|------|---------|------|
| 打开画布 | ✅ 读取 index.json | 一次性 |
| 选中会话 | ✅ 读取 {id}.json | 仅首次加载 |
| 发送消息 | ✅ 写入 {id}.json + index.json | 消息完成后 |
| 隐藏/显示聊天框 | ❌ 无 IO | 仅 CSS 切换 |
| 切换已加载的会话 | ❌ 无 IO | 内存中已有 |
| 删除会话 | ✅ 删除文件 + 更新 index | |

### 6. 内存缓存策略

```typescript
// 在 ChatRuntimeProvider 或单独的 context 中
const [indexCache, setIndexCache] = useState<ChatIndex | null>(null);
const [threadCache, setThreadCache] = useState<Map<string, ThreadData>>(new Map());

// 读取 index（带缓存）
async function getIndex(): Promise<ChatIndex> {
  if (indexCache) return indexCache;
  const index = await readIndex();
  setIndexCache(index);
  return index;
}

// 读取 thread（带缓存）
async function getThread(id: string): Promise<ThreadData | null> {
  if (threadCache.has(id)) return threadCache.get(id)!;
  const thread = await readThread(id);
  if (thread) {
    setThreadCache(prev => new Map(prev).set(id, thread));
  }
  return thread;
}

// 写入时同步更新缓存
async function saveThread(thread: ThreadData): Promise<void> {
  await writeThread(thread);
  setThreadCache(prev => new Map(prev).set(thread.id, thread));
}
```



- [ ] 创建新会话后，刷新页面会话仍存在
- [ ] 发送消息后，刷新页面消息仍存在
- [ ] 侧边栏正确显示会话列表
- [ ] 可以删除会话
- [ ] 可以重命名会话
- [ ] 可以归档/取消归档会话
- [ ] 切换会话时正确加载历史消息
- [ ] 会话文件存储在 `{projectDir}/chat/` 目录

## 注意事项

1. **Tauri API 版本**：确认使用的是 Tauri v1 还是 v2 的 API，导入路径可能不同
2. **错误处理**：文件操作需要 try-catch
3. **并发写入**：使用 debounce 避免频繁写入
4. **UUID**：需要安装 `uuid` 包：`pnpm add uuid && pnpm add -D @types/uuid`

## 预期文件结构

```
src/features/chat/
├── index.ts                   # 更新导出
├── ChatRuntimeProvider.tsx    # 更新：使用 useRemoteThreadListRuntime
├── useChatModelAdapter.ts     # 不变
├── useChatModelSelector.ts    # 不变
└── persistence/
    ├── index.ts
    ├── types.ts
    ├── storage.ts
    ├── ChatThreadListAdapter.ts
    └── ThreadHistoryAdapter.ts
```

## 开始实现

1. 创建 `persistence/` 目录和类型定义
2. 实现 `storage.ts` 底层 API
3. 实现 `ChatThreadListAdapter`
4. 实现 `ThreadHistoryAdapter`
5. 更新 `ChatRuntimeProvider`
6. 测试持久化功能
