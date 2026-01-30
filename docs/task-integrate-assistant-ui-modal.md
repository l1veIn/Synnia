# 任务：集成 assistant-ui 实现 Modal 聊天界面

## 项目背景

当前项目是一个基于 Tauri + React 的桌面应用（Synnia），已实现：
- ✅ ModelPlugin 系统（统一的模型管理）
- ✅ ChatModelAdapter 接口（用于聊天适配器）
- ✅ Gemini 模型已实现 getChatAdapter 方法
- ✅ Radix UI + Tailwind CSS 已配置
- ✅ React 19 + TypeScript 5

项目路径：`/Users/yangchen/Desktop/Synnia_chat`

## 任务目标

集成 assistant-ui 库，实现一个 **Modal 风格的聊天界面**（参考 https://www.assistant-ui.com/docs/ui/assistant-modal），具体要求：

1. **只实现 UI 层**：先不连接真实的聊天逻辑，使用 Mock Runtime
2. **实现浮动按钮 + Modal 对话框**：右下角浮动按钮，点击弹出聊天窗口
3. **完整的 UI 组件**：消息列表、输入框、发送按钮等
4. **在 Canvas 页面集成**：添加到主画布页面（`src/pages/Canvas.tsx`）

## 技术规范

### 依赖安装

```bash
pnpm add @assistant-ui/react @assistant-ui/react-ai-sdk
```

### 核心架构

```
Canvas.tsx  (主页面)
    └── AssistantModal  (聊天 Modal 组件)
            ├── AssistantModalPrimitive.Root  (状态管理)
            ├── AssistantModalPrimitive.Trigger  (浮动按钮)
            └── AssistantModalPrimitive.Content  (Modal 内容)
                    └── Thread  (聊天线程 UI)
                            ├── ThreadWelcome  (欢迎界面)
                            ├── ThreadMessages  (消息列表)
                            └── ThreadComposer  (输入框)
```

### Mock Runtime 实现

由于只实现 UI，需要创建一个 Mock Runtime Provider：

```typescript
// src/components/chat/MockRuntimeProvider.tsx
import { useLocalRuntime } from '@assistant-ui/react';
import { AssistantRuntimeProvider } from '@assistant-ui/react';

// Mock adapter that echoes user messages
const mockAdapter = {
    async *run({ messages }) {
        const lastMessage = messages[messages.length - 1];
        yield {
            content: [{
                type: 'text',
                text: `Echo: ${lastMessage.content}`
            }]
        };
    }
};

export function MockRuntimeProvider({ children }) {
    const runtime = useLocalRuntime(mockAdapter);
    return (
        <AssistantRuntimeProvider runtime={runtime}>
            {children}
        </AssistantRuntimeProvider>
    );
}
```

## 实现步骤

### Step 1: 安装依赖

```bash
cd /Users/yangchen/Desktop/Synnia_chat
pnpm add @assistant-ui/react @assistant-ui/react-ai-sdk
```

### Step 2: 创建 Mock Runtime Provider

创建文件：`src/components/chat/MockRuntimeProvider.tsx`

功能：
- 使用 `useLocalRuntime` 创建本地运行时
- 提供一个简单的 echo adapter（回声机器人）
- 包装 `AssistantRuntimeProvider`

### Step 3: 创建 AssistantModal 组件

创建文件：`src/components/chat/AssistantModal.tsx`

参考官方文档结构：
- 使用 `AssistantModalPrimitive` 组件
- 浮动按钮固定在右下角（`fixed right-4 bottom-4`）
- Modal 尺寸：`h-[500px] w-[400px]`
- 包含 `Thread` 组件用于显示聊天界面

### Step 4: 创建 Thread 组件

创建文件：`src/components/chat/Thread.tsx`

包含以下部分（参考 https://www.assistant-ui.com/docs/ui/thread）：
- `Thread.Root`: 容器
- `Thread.Viewport`: 消息滚动区域
- `Thread.Messages`: 消息列表
- `Thread.Composer`: 输入框和发送按钮

消息组件需要包含：
- 用户消息气泡（右对齐，主题色背景）
- 助手消息气泡（左对齐，灰色背景）
- 打字指示器（加载状态）

### Step 5: 样式设计

使用 Tailwind CSS 实现现代化设计：
- 浮动按钮：圆形，主题色，悬停缩放效果
- Modal：圆角，阴影，毛玻璃效果（可选）
- 消息气泡：圆角，适当间距
- 输入框：底部固定，带边框

### Step 6: 集成到 Canvas

在 `src/pages/Canvas.tsx` 中添加：

```typescript
import { AssistantModal } from '@/components/chat/AssistantModal';
import { MockRuntimeProvider } from '@/components/chat/MockRuntimeProvider';

// 在 Canvas 组件的 return 中添加：
<MockRuntimeProvider>
    <AssistantModal />
</MockRuntimeProvider>
```

位置：添加在最外层 div 中，与 ReactFlow 同级。

## 技术要点

### 1. AssistantModalPrimitive 使用

```typescript
import { AssistantModalPrimitive } from '@assistant-ui/react';

<AssistantModalPrimitive.Root>
    {/* Trigger button */}
    <AssistantModalPrimitive.Trigger asChild>
        <button>Open Chat</button>
    </AssistantModalPrimitive.Trigger>
    
    {/* Modal content */}
    <AssistantModalPrimitive.Content>
        <Thread />
    </AssistantModalPrimitive.Content>
</AssistantModalPrimitive.Root>
```

### 2. Thread 组件结构

```typescript
import { Thread } from '@assistant-ui/react';

<Thread.Root>
    <Thread.Viewport>
        <Thread.Messages />
    </Thread.Viewport>
    <Thread.Composer />
</Thread.Root>
```

### 3. 消息渲染

使用 `Thread.Messages` 时，assistant-ui 会自动渲染消息。可以通过 `components` prop 自定义：

```typescript
<Thread.Messages
    components={{
        UserMessage: CustomUserMessage,
        AssistantMessage: CustomAssistantMessage,
    }}
/>
```

### 4. Icon 使用

从 `lucide-react` 导入图标：
```typescript
import { MessageCircle, Send } from 'lucide-react';
```

## 验收标准

完成后应该能看到：

1. ✅ 右下角有一个浮动的圆形按钮（聊天图标）
2. ✅ 点击按钮弹出一个 400x500 的聊天 Modal
3. ✅ Modal 中包含完整的聊天界面：
   - 顶部标题栏（可选）
   - 消息滚动区域
   - 底部输入框 + 发送按钮
4. ✅ 输入消息后，收到 echo 回复（Mock Runtime）
5. ✅ UI 符合现代设计规范：
   - 圆角、阴影
   - 清晰的用户/助手消息区分
   - 流畅的动画效果
6. ✅ 响应式设计，适配不同屏幕尺寸
7. ✅ 按 Esc 键可关闭 Modal

## 代码规范

1. **组件位置**：
   - 所有聊天相关组件放在 `src/components/chat/` 目录
   - 导出统一通过 `index.ts`

2. **命名规范**：
   - 组件使用 PascalCase
   - 文件名与组件名一致
   - Props 接口命名：`[ComponentName]Props`

3. **TypeScript**：
   - 所有组件都要有类型定义
   - Props 必须声明接口
   - 避免使用 `any`

4. **样式**：
   - 使用 Tailwind CSS utility classes
   - 复杂样式可以提取到 CSS modules（可选）
   - 保持与项目现有风格一致

## 参考资源

- assistant-ui 官方文档：https://www.assistant-ui.com/docs
- AssistantModal 示例：https://www.assistant-ui.com/docs/ui/assistant-modal
- Thread 组件：https://www.assistant-ui.com/docs/ui/thread
- LocalRuntime：https://www.assistant-ui.com/docs/runtimes/custom/local

## 注意事项

1. **暂时不实现真实聊天**：
   - 使用 Mock Runtime 即可
   - 后续会替换为真实的 ModelPlugin adapter

2. **保持简洁**：
   - 先实现基础 UI
   - 复杂功能（历史记录、工具调用等）后续添加

3. **与现有代码集成**：
   - 不要修改现有的 ModelPlugin 系统
   - 不要影响 Canvas 的其他功能
   - AssistantModal 应该是独立的、可移除的

4. **代码组织**：
   - 所有新代码放在 `src/components/chat/` 下
   - 创建清晰的文件结构
   - 添加必要的注释

## 预期文件结构

```
src/components/chat/
├── index.ts                    # 统一导出
├── MockRuntimeProvider.tsx     # Mock Runtime
├── AssistantModal.tsx          # Modal 主组件
└── Thread.tsx                  # 聊天线程 UI
```

## 开始实现

请按照以上规范，完成 assistant-ui 的集成，实现 Modal 聊天界面。重点关注 UI 的完整性和美观性，业务逻辑可以先使用 Mock 实现。
