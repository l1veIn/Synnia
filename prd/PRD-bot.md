# Synnia Bot Feature PRD

## Tasks

- [x] Phase 1: 依赖安装和项目配置
- [x] Phase 2: Bot Store 和基础 UI
- [x] Phase 3: 面板互斥逻辑
- [x] Phase 4: Bot Runtime 配置
- [x] Phase 5: Bot Toolkit 实现（6 个核心工具）
- [x] Phase 6: 持久化实现
- [x] Phase 7: 危险操作确认流程
- [x] Phase 8: 快捷键集成
- [x] Phase 9: UI 主题自定义

---

## Overview

为 Synnia 画布页面添加 AI 助手（Bot），允许用户通过自然语言与画布交互。Bot 将作为左侧可收起的面板显示，支持流式对话、工具调用、对话历史持久化等功能。

### Goals

- **核心功能**: 通过自然语言查询、创建、更新、删除画布节点和资产
- **用户体验**: 流式响应、自动滚动、快捷键唤起（`Cmd+K`）
- **技术选型**: 使用 `assistant-ui` 框架（专注对话 UI，原生支持 Vercel AI SDK）
- **持久化**: 对话历史保存在 `{project}/.synnia/chat/` 目录
- **工具数量**: 6 个核心工具（get/create/update/delete）

### Constraints

- Bot Panel 位于**画布页面左侧**，与右侧 Properties Panel 互斥
- 使用 `assistant-ui` + `@assistant-ui/react-ai-sdk`（不使用 CopilotKit）
- 直接复用现有的 `modelRegistry`（Vercel AI SDK）
- 危险操作（delete）需用户确认
- 初始版本不支持 Edge 操作和节点执行触发
- 上下文管理：保留最近 10 条消息（简单策略）

---

## 技术选型：assistant-ui vs CopilotKit

### 核心决策：✅ 采用 assistant-ui

| 维度 | assistant-ui | CopilotKit |
|------|--------------|------------|
| **定位** | 专注对话 UI 组件库 | Agentic Application Platform |
| **核心功能** | 流式对话、UI 组件、状态管理 | 应用状态绑定 + Agent 编排 |
| **与 Synnia 契合度** | ✅ 高（仅需对话能力） | ❌ 低（过度设计） |
| **学习曲线** | 平缓（仅对话层） | 陡峭（shared state） |
| **打包体积** | 轻量 | 较重 |
| **Vercel AI SDK** | ✅ 原生支持 | ✅ 支持 |
| **自定义 Runtime** | LocalRuntime + ExternalStoreRuntime | 有自己的 Runtime 层 |

**选择 assistant-ui 的原因**：
1. 专注对话 UI，不包含应用状态绑定（我们已有 `GraphEngine`）
2. 原生 Vercel AI SDK 集成，直接复用 `modelRegistry`
3. 无头 + 可组合，完全控制样式
4. 流式响应开箱即用
5. 轻量级，不与现有架构冲突

---

## 架构设计

### 技术栈

```
┌──────────────────────────────────────────────────┐
│           Synnia 画布页面（Canvas Page）           │
│  ┌────────┐  ┌────────────────┐  ┌─────────────┐ │
│  │  Bot   │  │  Graph Area    │  │ Properties  │ │
│  │ Panel  │  │   (ReactFlow)  │  │   Panel     │ │
│  │ (Left) │  │                │  │  (Right)    │ │
│  └────────┘  └────────────────┘  └─────────────┘ │
│      ↕ 互斥                              ↕ 互斥   │
└──────────────────────────────────────────────────┘

Bot Panel 内部结构：
┌──────────────────────────────────────────────────┐
│  assistant-ui UI Components                     │
│  (Thread, Message, Input, Composer)             │
├──────────────────────────────────────────────────┤
│  @assistant-ui/react-ai-sdk                     │
│  (useChatRuntime, AssistantChatTransport)       │
├──────────────────────────────────────────────────┤
│  Vercel AI SDK (modelRegistry)                  │
│  (streamText, tool calling)                     │
├──────────────────────────────────────────────────┤
│  BotToolkit (6 个工具)                           │
│  → GraphEngine / AssetSystem                    │
└──────────────────────────────────────────────────┘
```

### 目录结构

```
src/
├── features/
│   └── bot/
│       ├── BotToolkit.ts          # 6 个工具定义
│       ├── BotRuntime.tsx         # useChatRuntime 配置
│       ├── types.ts               # 类型定义
│       └── persistence/
│           └── historyAdapter.ts  # LocalRuntime 的 history adapter
│
├── components/
│   └── bot/
│       ├── BotPanel.tsx           # 左侧面板容器
│       ├── BotChat.tsx            # 基于 assistant-ui 的对话界面
│       ├── BotHandle.tsx          # 收起状态的 Handle
│       └── ConfirmDialog.tsx      # 危险操作确认对话框
│
└── store/
    └── botStore.ts                # Bot 状态（Zustand）

{project}/.synnia/
└── chat/                          # 对话历史持久化
    └── {timestamp}.json           # 每个会话一个文件
```

---

## Phase 1: 依赖安装和项目配置

**优先级**: Critical  
**预估时间**: 0.5 天

### Subtasks

- [x] 安装 `@assistant-ui/react` (v0.12.1)
- [x] 安装 `@assistant-ui/react-ai-sdk` (v1.3.1)
- [x] 安装 `zod` (v4.3.6)
- [x] 验证现有的 `ai` 包版本 (v5.0.113 已安装)
- [x] 更新 `tsconfig.json` (无需更新)

### 验证步骤

```bash
# 安装依赖
pnpm add @assistant-ui/react @assistant-ui/react-ai-sdk zod

# 验证安装
pnpm list @assistant-ui/react
pnpm list @assistant-ui/react-ai-sdk
pnpm list zod

# 构建检查
pnpm tsc --noEmit
```

**MCP 验证**: 无需（仅依赖安装）

---

## Phase 2: Bot Store 和基础 UI

**优先级**: Critical  
**预估时间**: 1 天

### 实施内容

**1. 创建 `src/store/botStore.ts` - Zustand store**
   - 状态: `isPanelOpen: boolean`
   - 方法: `togglePanel()`, `closePanel()`, `openPanel()`

**2. 创建 `src/components/bot/BotHandle.tsx` - 收起状态的 Handle**
   - 固定左侧，垂直居中
   - 点击时调用 `togglePanel()`
   - Icon: `MessageSquare`（来自 `lucide-react`）

**3. 创建 `src/components/bot/BotPanel.tsx` - 面板容器**
   - 左侧固定，宽度 `400px`
   - 使用 CSS transition 实现滑入/滑出动画
   - 当 `isPanelOpen=false` 时仅显示 Handle

**4. 创建 `src/components/bot/BotChat.tsx` - 临时占位组件**
   - 显示 "Bot Chat Placeholder"

**5. 在 `src/pages/Canvas.tsx` 中集成 `BotPanel`**
   - 确保页面布局正确

### 验证步骤

**手动测试**:
1. 启动应用：`pnpm tauri dev`
2. 进入画布页面
3. **预期**: 看到左侧有 Bot Handle（MessageSquare icon）
4. 点击 Handle
5. **预期**: Bot Panel 从左侧滑入，宽度 400px

**MCP 截图验证**:
```
使用 Tauri MCP 截图功能，截取以下状态：
1. Bot Panel 关闭时（仅 Handle 可见）
2. Bot Panel 打开时（完整面板可见）
```

**MCP 点击验证**:
```
使用 Tauri MCP 点击功能：
1. 点击 Bot Handle
2. 验证面板打开
3. 再次点击 Handle（或面板内的关闭按钮）
4. 验证面板关闭
```

---

## Phase 3: 面板互斥逻辑

**优先级**: High  
**预估时间**: 0.5 天

### 实施内容

**1. 修改 `src/store/botStore.ts`**
   - 在 `togglePanel()` 中添加逻辑：打开 Bot Panel 时关闭 Properties Panel

**2. 修改 `src/store/workflowStore.ts`（或对应的 store）**
   - 在打开 Properties Panel 时关闭 Bot Panel

### 实现细节

```typescript
// botStore.ts
togglePanel: () => {
  const { isPanelOpen } = get();
  
  if (!isPanelOpen) {
    // 打开 Bot Panel 时，关闭 Properties Panel
    useWorkflowStore.getState().setSelectedNode(null);
  }
  
  set({ isPanelOpen: !isPanelOpen });
}
```

### 验证步骤

**手动测试**:
1. 打开 Bot Panel
2. **预期**: Properties Panel 自动关闭
3. 选择一个节点（应该打开 Properties Panel）
4. **预期**: Bot Panel 自动关闭
5. 使用 `Cmd+K` 快捷键
6. **预期**: Bot Panel 打开，Properties Panel 关闭

**MCP 点击验证**:
```
1. 点击 Bot Handle 打开面板
2. 点击画布上的节点
3. 验证 Bot Panel 关闭，Properties Panel 打开
```

---

## Phase 4: Bot Runtime 配置

**优先级**: Critical  
**预估时间**: 1 天

### 实施内容

**1. 创建 `src/features/bot/types.ts` - 类型定义**

**2. 创建 `src/features/bot/BotRuntime.tsx` - Runtime Provider**
   - 使用 `useChatRuntime` hook
   - 配置 API endpoint（需要创建 Tauri 命令）
   - 配置 system prompt

**3. 创建 Tauri 命令 `src-tauri/src/commands/bot.rs`**
   - `bot_chat` - 转发请求到 Vercel AI SDK

**4. 在 `BotPanel.tsx` 中包裹 `BotRuntimeProvider`**

**5. 更新 `BotChat.tsx` 使用 assistant-ui 的 `<Thread />` 组件**

### 验证步骤

**手动测试**:
1. 打开 Bot Panel
2. **预期**: 看到 assistant-ui 的对话界面（空消息列表 + 输入框）
3. 输入 "Hello"
4. **预期**: 看到流式响应（即使只是 echo，先验证 Runtime 工作）

**MCP 截图验证**:
```
截取 Bot Panel 打开后的对话界面状态
```

---

## Phase 5: Bot Toolkit 实现（6 个核心工具）

**优先级**: Critical  
**预估时间**: 2 天

### 实施内容

**创建 `src/features/bot/BotToolkit.ts`** - 实现 6 个工具（详见代码示例文档 `PRD-bot-examples.md`）
  
#### 工具列表

1. **get_nodes_list** - 获取画布节点列表
   - 参数: 无
   - 返回: `{ id, type, title, state, position, assetId }[]`

2. **get_asset_details** - 获取资产详情
   - 参数: `{ assetIds: string[] }`
   - 返回: Asset 对象数组

3. **create_node_smart** - 创建节点
   - 参数: `{ nodeType, value, position? }`
   - 调用: `graphEngine.mutator.createSmart()`

4. **update_nodes** - 更新节点
   - 参数: `{ updates: Array<{ id, data }> }`
   - 调用: `graphEngine.updateNode()`

5. **update_assets** - 更新资产
   - 参数: `{ updates: Array<{ id, value }> }`
   - 调用: `graphEngine.assets.update()`

6. **delete_nodes** - 删除节点（需确认）
   - 参数: `{ nodeIds: string[] }`
   - 调用: `graphEngine.deleteNodes()`
   - 特殊: 需弹出确认对话框

### 验证步骤

**手动测试 - 工具 1: get_nodes_list**:
1. 在画布上创建 2-3 个节点
2. 在 Bot 中输入："列出所有节点"
3. **预期**: Bot 调用 `get_nodes_list`，返回节点列表

**手动测试 - 工具 3: create_node_smart**:
1. 输入："创建一个文本节点，内容为 'Hello Bot'"
2. **预期**: 画布上出现新的文本节点
3. **预期**: Bot 回复确认信息（包含节点 ID）

**手动测试 - 工具 6: delete_nodes**:
1. 输入："删除节点 [ID]"
2. **预期**: 弹出确认对话框
3. 点击"确认"
4. **预期**: 节点被删除
5. 再次尝试删除，点击"取消"
6. **预期**: 节点未被删除，Bot 返回取消信息

**MCP 截图验证**:
```
1. 截取 Bot 调用工具后的响应界面
2. 截取画布上新创建的节点
3. 截取删除确认对话框
```

---

## Phase 6: 持久化实现

**优先级**: High  
**预估时间**: 1 天

### 实施内容

**1. 创建 `src/features/bot/persistence/historyAdapter.ts`**
   - 实现 `HistoryAdapter` 接口
   - `save(messages)` - 保存到 Tauri backend
   - `load()` - 从 Tauri backend 加载

**2. 创建 Tauri 命令**
   - `save_bot_history` - 保存对话历史到 `{project}/.synnia/chat/{timestamp}.json`
   - `load_bot_history` - 加载最近的对话历史
   - `list_bot_sessions` - 列出所有会话（可选，用于 UI）

**3. 在 `BotRuntime.tsx` 中集成 `historyAdapter`**

### 验证步骤

**手动测试**:
1. 与 Bot 对话 3-5 轮
2. 刷新页面或重启应用
3. **预期**: 对话历史被恢复
4. 检查文件系统
5. **预期**: 存在 `{project}/.synnia/chat/{timestamp}.json` 文件

**MCP 验证**:
```
使用 Tauri MCP 读取文件：
1. 读取 {project}/.synnia/chat/ 目录
2. 验证 JSON 文件存在
3. 验证文件内容格式正确
```

---

## Phase 7: 危险操作确认流程

**优先级**: High  
**预估时间**: 0.5 天

### 实施内容

**1. 创建 `src/components/bot/ConfirmDialog.tsx`**
   - 使用 Radix UI Dialog
   - 显示操作描述
   - "确认" 和 "取消" 按钮

**2. 在 `botStore.ts` 中添加确认对话框状态**
   - `confirmDialogOpen: boolean`
   - `confirmMessage: string`
   - `confirmCallback: (() => void) | null`

**3. 在 `BotToolkit.ts` 的 `delete_nodes` 工具中实现确认逻辑**

### 验证步骤

**手动测试**:
1. 创建 2 个节点
2. 输入："删除这两个节点"
3. **预期**: 弹出确认对话框，显示 "确定要删除 2 个节点吗？"
4. 点击"取消"
5. **预期**: 节点未被删除，Bot 回复 "操作已取消"
6. 再次输入删除命令，点击"确认"
7. **预期**: 节点被删除，Bot 回复确认信息

**MCP 点击验证**:
```
1. 触发删除操作
2. 点击确认对话框的"取消"按钮
3. 验证节点未被删除
4. 再次触发，点击"确认"
5. 验证节点被删除
```

---

## Phase 8: 快捷键集成

**优先级**: Medium  
**预估时间**: 0.5 天

### 实施内容

**在 `src/App.tsx` 或全局热键管理处添加 `Cmd+K` 监听**
   - 使用 `useEffect` + `window.addEventListener('keydown')`
   - 检测 `(e.metaKey || e.ctrlKey) && e.key === 'k'`
   - 调用 `useBotStore.getState().togglePanel()`

### 验证步骤

**手动测试**:
1. 在画布页面，按 `Cmd+K`（Mac）或 `Ctrl+K`（Windows/Linux）
2. **预期**: Bot Panel 打开
3. 再次按 `Cmd+K`
4. **预期**: Bot Panel 关闭

---

## Phase 9: UI 主题自定义

**优先级**: Low  
**预估时间**: 0.5 天

### 实施内容

**1. 自定义 assistant-ui 的主题样式**
   - 使用 Synnia 的 color scheme
   - 调整字体、间距、圆角等
   - 确保与 Synnia UI 风格一致

**2. 自定义消息组件样式**
   - 用户消息：右对齐，蓝色背景
   - AI 消息：左对齐，灰色背景

### 验证步骤

**MCP 截图验证**:
```
截取最终的 Bot Panel UI，确保：
1. 颜色与 Synnia 主题一致
2. 消息样式美观
3. 输入框样式统一
```

---

## Success Criteria

1. ✅ `pnpm tauri dev` 运行无错误
2. ✅ Bot Panel 在画布页面左侧正常显示
3. ✅ `Cmd+K` 快捷键正常工作
4. ✅ Bot Panel 与 Properties Panel 正确互斥
5. ✅ 6 个核心工具全部正常工作
6. ✅ 流式响应正常显示
7. ✅ 对话历史持久化正常
8. ✅ 删除节点时确认对话框正常弹出
9. ✅ `pnpm lint` 无错误
10. ✅ `pnpm tsc --noEmit` 无错误

---

## Notes

- Bot Panel 仅在**画布页面**显示，不在其他页面（如设置页、Recipe 编辑器）
- 初始版本不支持 Edge 操作（创建/删除连接）
- 初始版本不支持触发节点执行（可后续添加）
- 上下文管理采用简单策略（保留最近 10 条消息）
- 所有代码示例详见 `PRD-bot-examples.md`
- 使用 Tauri MCP 进行截图和点击验证（非严格 E2E 测试）

---

## Implementation Reference

详细的代码示例、API 设计和验证脚本请参考：
- **[PRD-bot-examples.md](./PRD-bot-examples.md)** - 完整的代码示例和 MCP 验证脚本
