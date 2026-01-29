# Synnia Bot 设计方案 v2

> 更新日期: 2026-01-28  
> 状态: 待讨论  
> 基于用户反馈的精简实施版本

## 核心决策

### ❌ 不采用 CopilotKit

**原因分析**：
1. **过度设计**：CopilotKit 是通用框架，包含大量我们不需要的功能（如 Textarea 组件、后端 Runtime 等）
2. **学习成本**：引入新框架需要学习其抽象层，而我们的需求足够简单
3. **灵活性限制**：CopilotKit 有自己的状态管理和生命周期，可能与 Synnia 的 GraphEngine 架构冲突
4. **体积问题**：额外依赖会增加打包体积

**我们的方案更合适**：
- 直接复用现有的 `modelRegistry` 和 `apiClient`
- 与 `GraphEngine` 深度集成，无需适配层
- 完全控制 UI 和交互逻辑
- 轻量级实现

---

## 架构设计

### 1. UI 布局

```
┌────────────────────────────────────────────────────┐
│                  Synnia Canvas                      │
│  ┌─────┐  ┌────────────────────┐  ┌──────────────┐ │
│  │ Bot │  │     Graph Area     │  │  Properties  │ │
│  │Panel│  │                    │  │    Panel     │ │
│  └─────┘  └────────────────────┘  └──────────────┘ │
│  (Left)                                (Right)      │
└────────────────────────────────────────────────────┘
```

**关键策略**：
- Bot Panel 默认左侧
- 与右侧 Properties Panel 互斥（同时只显示一个）
- 收起时仅显示 Handle（可点击展开）
- 快捷键 `Cmd+K` 唤起

---

### 2. 目录结构

```
src/
├── features/
│   └── bot/
│       ├── BotAgent.ts           # 画布操作 API（直接调用 GraphEngine）
│       ├── BotExecutor.ts        # LLM 调用和工具执行
│       └── types.ts              # 类型定义
│
├── components/
│   └── bot/
│       ├── BotPanel.tsx          # 侧边面板容器
│       ├── BotChat.tsx           # 对话界面
│       └── BotHandle.tsx         # 收起状态的 Handle
│
└── store/
    └── botStore.ts                # Bot 状态管理（Zustand）

{project}/.synnia/
└── chat/                          # 对话历史（JSON 格式）
    └── {timestamp}.json
```

---

### 3. 持久化策略

**参考成熟方案**：类似 Cursor / VS Code 的对话历史存储

```typescript
// {project}/.synnia/chat/{timestamp}.json
{
  "id": "chat_1706442000000",
  "createdAt": 1706442000000,
  "updatedAt": 1706442500000,
  "messages": [
    {
      "role": "user",
      "content": "Create a text node with 'Hello World'",
      "timestamp": 1706442000000
    },
    {
      "role": "assistant",
      "content": "Created a text node at position (100, 100)",
      "timestamp": 1706442001000,
      "toolCalls": [
        {
          "name": "create_node_smart",
          "args": { "type": "text", "value": "Hello World", "position": { "x": 100, "y": 100 } },
          "result": { "nodeId": "node_123" }
        }
      ]
    }
  ]
}
```

**策略**：
- 每个会话一个 JSON 文件
- 文件名为时间戳，方便排序
- 保留最近 N 条（例如 50 条）
- 超过限制自动归档或删除旧记录

---

## 核心能力（MVP）

严格限制在以下 6 个工具：

### 1. **get_nodes_list**
```typescript
{
  name: 'get_nodes_list',
  description: '获取画布上所有节点的列表，包括 id、type、data',
  parameters: { type: 'object', properties: {} },
  handler: () => {
    const { nodes } = graphEngine.state;
    return nodes.map(n => ({
      id: n.id,
      type: n.type,
      title: n.data.title,
      state: n.data.state,
      position: n.position,
      assetId: n.data.assetId  // 关键信息
    }));
  }
}
```

### 2. **get_asset_details**
```typescript
{
  name: 'get_asset_details',
  description: '获取资产的详细信息（支持单个或多个 ID）',
  parameters: {
    type: 'object',
    properties: {
      assetIds: { 
        type: 'array', 
        items: { type: 'string' },
        description: '资产 ID 列表'
      }
    },
    required: ['assetIds']
  },
  handler: (args) => {
    return args.assetIds.map(id => graphEngine.assets.get(id));
  }
}
```

### 3. **create_node_smart**
```typescript
{
  name: 'create_node_smart',
  description: '创建新节点（使用 GraphMutator.createSmart）',
  parameters: {
    type: 'object',
    properties: {
      nodeType: { 
        type: 'string', 
        enum: ['text', 'image', 'form', 'recipe', 'selector', 'gallery'] 
      },
      value: { type: 'any', description: '节点内容' },
      position: { 
        type: 'object', 
        properties: { x: { type: 'number' }, y: { type: 'number' } } 
      }
    },
    required: ['nodeType', 'value']
  },
  handler: (args) => {
    return graphEngine.mutator.createSmart({
      nodeType: args.nodeType,
      value: args.value,
      position: args.position || { x: 100, y: 100 }
    });
  }
}
```

### 4. **update_nodes**
```typescript
{
  name: 'update_nodes',
  description: '更新一个或多个节点的信息',
  parameters: {
    type: 'object',
    properties: {
      updates: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            data: { type: 'object' }  // Partial<BaseNodeData>
          },
          required: ['id', 'data']
        }
      }
    },
    required: ['updates']
  },
  handler: (args) => {
    args.updates.forEach(({ id, data }) => {
      graphEngine.updateNode(id, { data });
    });
  }
}
```

### 5. **update_assets**
```typescript
{
  name: 'update_assets',
  description: '更新一个或多个资产的信息',
  parameters: {
    type: 'object',
    properties: {
      updates: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            value: { type: 'any' }
          },
          required: ['id', 'value']
        }
      }
    },
    required: ['updates']
  },
  handler: (args) => {
    args.updates.forEach(({ id, value }) => {
      graphEngine.assets.update(id, value);
    });
  }
}
```

### 6. **delete_nodes** ⚠️ 危险操作
```typescript
{
  name: 'delete_nodes',
  description: '删除节点（危险操作，需用户确认）',
  parameters: {
    type: 'object',
    properties: {
      nodeIds: { 
        type: 'array', 
        items: { type: 'string' },
        description: '要删除的节点 ID 列表'
      }
    },
    required: ['nodeIds']
  },
  requiresConfirmation: true,  // 标记为需要确认
  handler: (args) => {
    graphEngine.deleteNodes(args.nodeIds);
  }
}
```

---

## 模型选择

**直接复用 ModelTab 设计**：

```typescript
// src/features/bot/BotExecutor.ts

import { modelRegistry } from '@/core/registry/ModelRegistry';

export class BotExecutor {
  async execute(userMessage: string, tools: BotTool[]) {
    // 1. 获取用户选择的模型
    const selectedModel = modelRegistry.getSelectedModel('chat'); // 按 chat 能力筛选
    
    // 2. 调用模型（流式响应）
    const stream = await selectedModel.execute({
      messages: this.buildMessages(userMessage),
      tools: tools.map(t => this.convertToModelTool(t)),
      stream: true  // 流式响应
    });
    
    // 3. 处理流式输出
    for await (const chunk of stream) {
      if (chunk.type === 'tool_call') {
        await this.handleToolCall(chunk.toolCall);
      } else if (chunk.type === 'text') {
        this.appendToMessage(chunk.text);
      }
    }
  }
}
```

---

## 实施路径

| Phase | 内容 | 预估时间 |
|-------|------|---------|
| **1** | BotStore + BotPanel UI（左侧栏 + Handle） | 1 天 |
| **2** | BotChat UI（流式响应显示） | 1 天 |
| **3** | BotExecutor（接入 modelRegistry） | 1 天 |
| **4** | BotAgent + 6 个核心工具实现 | 2 天 |
| **5** | 持久化（.synnia/chat/） | 1 天 |
| **6** | 危险操作确认流程 | 0.5 天 |

**总计**: 约 6.5 天

---

## 交互细节

### 流式响应

```typescript
// BotChat.tsx

export function BotChat() {
  const { messages, isStreaming, streamingText } = useBotStore();
  
  return (
    <div className="flex flex-col h-full">
      {messages.map(msg => (
        <BotMessage key={msg.id} message={msg} />
      ))}
      
      {/* 流式输出中的消息 */}
      {isStreaming && (
        <BotMessage 
          message={{ 
            role: 'assistant', 
            content: streamingText,
            streaming: true 
          }} 
        />
      )}
    </div>
  );
}
```

### 面板互斥逻辑

```typescript
// src/store/botStore.ts

interface BotState {
  isPanelOpen: boolean;
  
  togglePanel: () => void;
}

export const useBotStore = create<BotState>()((set, get) => ({
  isPanelOpen: false,
  
  togglePanel: () => {
    const { isPanelOpen } = get();
    
    // 打开 Bot Panel 时，关闭 Properties Panel
    if (!isPanelOpen) {
      useWorkflowStore.getState().closePropertiesPanel(); // 假设有这个方法
    }
    
    set({ isPanelOpen: !isPanelOpen });
  }
}));
```

### 快捷键

```typescript
// src/App.tsx 或全局热键管理

useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      useBotStore.getState().togglePanel();
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

---

## 上下文管理

**简单策略（初始版本）**：

```typescript
export class BotContext {
  getMessages(): Message[] {
    const history = useBotStore.getState().currentSession?.messages || [];
    
    // 保留最近 10 条消息
    return history.slice(-10);
  }
  
  getSystemPrompt(): string {
    return `
You are an AI assistant embedded in Synnia, a visual workflow canvas.

Available tools:
- get_nodes_list: Get all nodes on the canvas
- get_asset_details: Get details of specific assets
- create_node_smart: Create new nodes
- update_nodes: Update node properties
- update_assets: Update asset values
- delete_nodes: Delete nodes (requires confirmation)

Guidelines:
- Always call get_nodes_list first to understand the current canvas state
- Be concise in your responses
- When creating nodes, use smart positioning
    `.trim();
  }
}
```

---

## 错误处理

**简单策略（初始版本）**：

```typescript
export class BotExecutor {
  async handleToolCall(toolCall: ToolCall) {
    try {
      const tool = this.findTool(toolCall.name);
      const result = await tool.handler(toolCall.args);
      
      this.addToolResult(toolCall.id, result);
    } catch (error) {
      // 记录错误，直接断掉对话
      this.addErrorMessage(`Tool execution failed: ${error.message}`);
      
      // 停止当前对话流，让用户决定下一步
      return;
    }
  }
}
```

---

## 总结

这个精简版方案：
- ✅ **无外部框架依赖**（不使用 CopilotKit）
- ✅ **深度集成 GraphEngine**（直接调用 API）
- ✅ **MVP 功能最小化**（6 个核心工具）
- ✅ **成熟的持久化策略**（JSON 文件，类似 Cursor）
- ✅ **流式响应**（用户体验优先）
- ✅ **左侧栏 + 互斥设计**（避免冲突）
- ✅ **快捷键支持**（Cmd+K）
- ✅ **简单的上下文和错误处理**（初始版本够用）
