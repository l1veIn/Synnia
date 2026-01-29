# Synnia Bot 设计方案

> 初始方案 v0.1 - 2026-01-28
> 状态: 待讨论

## 概述

在 Synnia 画布应用中嵌入 AI 助手，采用 **Cursor 风格的侧边 Chat Panel**，能够：
1. **读取画布内容** - 获取所有节点、边、资产的状态
2. **创建节点** - 通过自然语言生成新节点
3. **管理节点** - 修改、删除、连接节点

## 设计原则

- 画布上只有资产节点，Bot 不作为节点存在
- 侧边面板可收起，不影响画布操作
- 复用现有 model provider 设置
- 对话历史持久化（按项目）
- 危险操作需用户确认

---

## 技术架构

```
┌─────────────────────────────────────────┐
│              Synnia Canvas               │
│  ┌─────────────────────────────────┐    │
│  │         GraphEngine              │    │
│  │  - nodes, edges, assets         │    │
│  │  - mutator (add/update/delete)  │    │
│  └──────────────┬──────────────────┘    │
│                 │                        │
│  ┌──────────────▼──────────────────┐    │
│  │          BotAgent               │    │
│  │  - readCanvas()                 │    │
│  │  - createNode(type, data)       │    │
│  │  - updateNode(id, patch)        │    │
│  │  - deleteNode(id)               │    │
│  │  - connect(src, dst)            │    │
│  └──────────────┬──────────────────┘    │
│                 │                        │
│  ┌──────────────▼──────────────────┐    │
│  │         LLM Provider            │    │
│  │  (复用 modelRegistry)            │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

---

## 目录结构

```
src/
├── features/
│   └── bot/                        # Bot 核心模块
│       ├── BotAgent.ts             # 画布操作 API
│       ├── BotContext.ts           # 画布快照生成
│       ├── BotToolkit.ts           # Function Calling 工具定义
│       ├── BotExecutor.ts          # 调用 LLM 并执行工具
│       └── types.ts                # 类型定义
│
├── components/
│   └── bot/                        # UI 组件
│       ├── BotPanel.tsx            # 侧边面板容器
│       ├── BotChat.tsx             # 对话界面
│       ├── BotMessage.tsx          # 消息气泡
│       ├── BotInput.tsx            # 输入框
│       └── BotConfirmDialog.tsx    # 危险操作确认
│
├── store/
│   └── botStore.ts                 # Bot 状态管理
│
└── types/
    └── bot.ts                      # 类型定义
```

---

## 核心类型

```typescript
// src/types/bot.ts

export interface BotMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];       // 执行的操作
  pending?: boolean;            // 等待确认
}

export interface ToolCall {
  id: string;
  name: string;                 // 'createNode' | 'deleteNode' | ...
  args: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
  result?: any;
}

export interface BotSession {
  id: string;
  messages: BotMessage[];
  createdAt: number;
  updatedAt: number;
}
```

---

## BotAgent - 画布操作 API

```typescript
// src/features/bot/BotAgent.ts

import { graphEngine } from '@core/engine/GraphEngine';
import { NodeType, SynniaNode } from '@/types/project';

export class BotAgent {
  // ===== 读取能力 =====
  
  /** 获取画布完整快照（供 LLM 理解上下文） */
  getCanvasSnapshot(): CanvasSnapshot {
    const { nodes, edges, assets } = graphEngine.state;
    return {
      nodes: nodes.map(n => ({
        id: n.id,
        type: n.type,
        title: n.data.title,
        position: n.position,
        state: n.data.state,
        assetPreview: this.getAssetPreview(n.data.assetId),
      })),
      edges: edges.map(e => ({
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      })),
      summary: this.generateSummary(nodes),
    };
  }

  // ===== 创建能力 =====
  
  createNode(type: NodeType, position: XYPosition, data?: Partial<BaseNodeData>): string {
    return graphEngine.mutator.createNode(type, position, data);
  }

  createTextNode(content: string, position: XYPosition): string {
    // 创建节点并设置内容
  }

  createImageNode(imageUrl: string, position: XYPosition): string {
    // 创建图片节点
  }

  // ===== 修改能力 =====
  
  updateNode(id: string, patch: Partial<BaseNodeData>): void {
    graphEngine.updateNode(id, { data: patch });
  }

  moveNode(id: string, position: XYPosition): void {
    graphEngine.updateNode(id, { position });
  }

  // ===== 连接能力 =====
  
  connectNodes(sourceId: string, targetId: string): void {
    graphEngine.connect({ source: sourceId, target: targetId });
  }

  // ===== 删除能力（需确认） =====
  
  deleteNode(id: string): void {
    graphEngine.mutator.deleteNodes([id]);
  }

  deleteNodes(ids: string[]): void {
    graphEngine.mutator.deleteNodes(ids);
  }

  // ===== 执行能力 =====
  
  async runNode(id: string): Promise<void> {
    // 触发节点执行
  }
}

export const botAgent = new BotAgent();
```

---

## BotToolkit - Function Calling 定义

```typescript
// src/features/bot/BotToolkit.ts

export const BOT_TOOLS = [
  {
    name: 'get_canvas',
    description: '获取当前画布上所有节点和连接的信息',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'create_text_node',
    description: '创建一个文本节点',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: '文本内容' },
        x: { type: 'number', description: 'X 坐标' },
        y: { type: 'number', description: 'Y 坐标' },
      },
      required: ['content'],
    },
  },
  {
    name: 'create_image_node',
    description: '创建一个图片节点',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '图片描述或URL' },
        x: { type: 'number' },
        y: { type: 'number' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'connect_nodes',
    description: '连接两个节点',
    parameters: {
      type: 'object',
      properties: {
        sourceId: { type: 'string' },
        targetId: { type: 'string' },
      },
      required: ['sourceId', 'targetId'],
    },
  },
  {
    name: 'delete_nodes',
    description: '删除节点（危险操作，需用户确认）',
    parameters: {
      type: 'object',
      properties: {
        nodeIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['nodeIds'],
    },
    requiresConfirmation: true,  // 标记需要确认
  },
  {
    name: 'run_node',
    description: '执行指定节点',
    parameters: {
      type: 'object',
      properties: {
        nodeId: { type: 'string' },
      },
      required: ['nodeId'],
    },
  },
];
```

---

## BotStore - 状态管理

```typescript
// src/store/botStore.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BotMessage, BotSession } from '@/types/bot';

interface BotState {
  isOpen: boolean;
  sessions: Record<string, BotSession>;  // projectId -> session
  currentProjectId: string | null;
  pendingToolCalls: ToolCall[];
  
  // Actions
  togglePanel: () => void;
  addMessage: (msg: BotMessage) => void;
  approveToolCall: (callId: string) => void;
  rejectToolCall: (callId: string) => void;
  clearSession: () => void;
}

export const useBotStore = create<BotState>()(
  persist(
    (set, get) => ({
      isOpen: false,
      sessions: {},
      currentProjectId: null,
      pendingToolCalls: [],
      
      togglePanel: () => set(s => ({ isOpen: !s.isOpen })),
      
      addMessage: (msg) => {
        const projectId = get().currentProjectId;
        if (!projectId) return;
        // ... 添加消息到当前 session
      },
      
      approveToolCall: (callId) => {
        // 执行工具调用
      },
      
      rejectToolCall: (callId) => {
        // 取消工具调用
      },
      
      clearSession: () => {
        // 清空当前会话
      },
    }),
    {
      name: 'synnia-bot',
      partialize: (state) => ({ sessions: state.sessions }),
    }
  )
);
```

---

## UI - 侧边面板

```tsx
// src/components/bot/BotPanel.tsx

export function BotPanel() {
  const { isOpen, togglePanel } = useBotStore();
  
  return (
    <>
      {/* 悬浮按钮 */}
      <button 
        onClick={togglePanel}
        className="fixed right-4 bottom-4 p-3 rounded-full bg-primary"
      >
        <BotIcon />
      </button>
      
      {/* 侧边面板 */}
      <aside className={cn(
        "fixed right-0 top-0 h-full w-[400px] bg-background border-l",
        "transform transition-transform duration-300",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <BotHeader onClose={togglePanel} />
        <BotChat />
        <BotInput />
      </aside>
    </>
  );
}
```

---

## 权限控制流程

```
用户输入 → LLM 生成 ToolCall → 分类
                                 ↓
                    ┌────────────┴────────────┐
                    ↓                         ↓
              安全操作                    危险操作
          (create, connect)         (delete, bulk edit)
                    ↓                         ↓
               直接执行              弹出确认对话框
                                              ↓
                                    用户确认 → 执行
                                    用户取消 → 跳过
```

---

## 持久化策略

对话历史按 **projectId** 分开存储：

**方案 A: localStorage (简单)**
- 使用 zustand persist 存到 localStorage
- 优点：简单、即开即用
- 缺点：不跟随项目迁移

**方案 B: 项目文件 (推荐)**
- 保存到项目的 `.synnia/bot-history.json`
- 优点：跟随项目、可版本控制
- 缺点：需要文件 I/O

---

## 实现顺序

| Phase | 内容 | 优先级 |
|-------|------|--------|
| 1 | BotStore + BotPanel UI（开关面板） | P0 |
| 2 | BotChat + BotInput（对话界面） | P0 |
| 3 | BotAgent 读取能力（`getCanvasSnapshot`） | P0 |
| 4 | BotExecutor 接入 LLM（复用 modelRegistry） | P0 |
| 5 | BotToolkit + 工具执行 | P1 |
| 6 | 权限确认流程 | P1 |
| 7 | 持久化 | P2 |

---

## 待讨论问题

1. **快捷键**: 用什么快捷键唤起 Bot？`Cmd+B`? `Cmd+/`?
2. **上下文窗口**: 发送给 LLM 的画布快照要包含多少细节？
3. **多轮对话**: 历史消息保留多少条发送给 LLM？
4. **错误恢复**: 工具执行失败后如何处理？
5. **Undo 集成**: Bot 的操作是否要集成到 undo/redo 栈？
6. **批量操作**: 是否支持类似 "删除所有图片节点" 的批量命令？

---

