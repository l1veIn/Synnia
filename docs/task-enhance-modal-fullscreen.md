# 任务：增强 AssistantModal + 实现全屏模式（纯 UI 层）

## ⚠️ 重要说明

**本任务只涉及 UI 层，不涉及任何业务逻辑！**

- ✅ 使用现有的 `MockRuntimeProvider`（Echo 机器人）
- ✅ 历史记录使用 **内存状态 / localStorage** 实现
- ❌ **不要** 引入真正的 AI 模型调用
- ❌ **不要** 实现复杂的持久化逻辑
- ❌ **不要** 修改 `ModelPlugin` 或 `ChatModelAdapter`

## 项目背景

当前项目已完成 assistant-ui Modal 的基础集成：
- ✅ `MockRuntimeProvider` 已实现（Echo 机器人）
- ✅ `AssistantModal` 已实现（浮动按钮 + 弹出对话框）
- ✅ `Thread` 组件已实现（消息列表、输入框）

项目路径：`/Users/yangchen/Desktop/Synnia_chat`
组件路径：`src/components/assistant-ui/`

### 当前 Mock Runtime 

```tsx
// mock-runtime-provider.tsx - 保持不变
const mockAdapter = {
    async *run({ messages }) {
        const lastMessage = messages[messages.length - 1];
        const text = lastMessage.content[0]?.text || "";
        yield {
            content: [{ type: "text", text: `Echo: ${text}` }],
        };
    },
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

## 任务目标

### Phase 1：增强现有 Modal
1. **添加标题栏**：标题 + 新对话按钮 + 放大按钮 + 关闭按钮
2. **实现拖动**：拖动标题栏可移动整个 Modal
3. **实现 resize**：Modal 可调整大小

### Phase 2：实现全屏模式（UI Only）
1. **全屏组件**：点击放大按钮切换到全屏
2. **侧边栏 UI**：显示会话列表（用内存 Mock 数据）
3. **会话管理 UI**：新建/切换/删除按钮（只做 UI 交互，用 useState 管理）

## 核心架构

```
Canvas.tsx
└── TooltipProvider
    └── MockRuntimeProvider  ← 保持现有的，不修改
        ├── AssistantModal   ← 增强（标题栏、拖动、resize）
        │   ├── ModalHeader  ← 新增
        │   └── Thread       ← 复用
        │
        └── AssistantFullscreen  ← 新增（纯 UI）
            ├── Sidebar          ← 新增（Mock 数据）
            │   └── MockThreadList
            └── Thread           ← 复用
```

## 实现步骤

### Step 1: 创建 ModalHeader

文件：`src/components/assistant-ui/modal-header.tsx`

```tsx
import { X, Plus, Maximize2 } from 'lucide-react';
import { TooltipIconButton } from './tooltip-icon-button';

interface ModalHeaderProps {
  title?: string;
  onNewChat?: () => void;
  onExpand?: () => void;
  onClose?: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;  // 用于拖动
}

export const ModalHeader = ({
  title = 'Assistant',
  onNewChat,
  onExpand,
  onClose,
  onMouseDown,
}: ModalHeaderProps) => {
  return (
    <div
      className="flex items-center justify-between px-3 py-2 border-b bg-muted/50 cursor-move select-none"
      onMouseDown={onMouseDown}
    >
      <span className="font-medium text-sm">{title}</span>
      <div className="flex items-center gap-0.5">
        <TooltipIconButton tooltip="New Chat" variant="ghost" size="sm" onClick={onNewChat}>
          <Plus className="size-4" />
        </TooltipIconButton>
        <TooltipIconButton tooltip="Expand" variant="ghost" size="sm" onClick={onExpand}>
          <Maximize2 className="size-4" />
        </TooltipIconButton>
        <TooltipIconButton tooltip="Close" variant="ghost" size="sm" onClick={onClose}>
          <X className="size-4" />
        </TooltipIconButton>
      </div>
    </div>
  );
};
```

### Step 2: 增强 AssistantModal

修改：`src/components/assistant-ui/assistant-modal.tsx`

关键改动：
1. 添加 `ModalHeader` 组件
2. 添加拖动逻辑（用 useState + useEffect 管理位置）
3. 添加 resize 逻辑（用 CSS 或自定义 handle）
4. 添加 `onExpand` prop 用于切换全屏

```tsx
// 状态管理
const [position, setPosition] = useState({ x: 16, y: window.innerHeight - 550 });
const [size, setSize] = useState({ width: 400, height: 500 });
const [isDragging, setIsDragging] = useState(false);

// 拖动逻辑
const handleDragStart = (e: React.MouseEvent) => {
  e.preventDefault();
  setIsDragging(true);
  // ... 记录起始位置
};

// Modal Content 使用 fixed 定位
<div
  style={{
    position: 'fixed',
    left: position.x,
    top: position.y,
    width: size.width,
    height: size.height,
  }}
>
  <ModalHeader onExpand={...} onClose={...} onMouseDown={handleDragStart} />
  <Thread />
</div>
```

### Step 3: 创建全屏组件（纯 UI）

文件：`src/components/assistant-ui/assistant-fullscreen.tsx`

```tsx
import { useState } from 'react';
import { X, Plus, Trash2, MessageSquare } from 'lucide-react';
import { Thread } from './thread';
import { TooltipIconButton } from './tooltip-icon-button';

interface AssistantFullscreenProps {
  isOpen: boolean;
  onClose: () => void;
}

// Mock 会话数据（纯 UI，用 useState 管理）
interface MockThread {
  id: string;
  title: string;
}

export const AssistantFullscreen = ({ isOpen, onClose }: AssistantFullscreenProps) => {
  // Mock 会话列表（内存状态）
  const [threads, setThreads] = useState<MockThread[]>([
    { id: '1', title: 'New Chat' },
  ]);
  const [activeThreadId, setActiveThreadId] = useState('1');

  // 新建会话（只是 UI 操作）
  const handleNewThread = () => {
    const newThread = { id: Date.now().toString(), title: 'New Chat' };
    setThreads(prev => [newThread, ...prev]);
    setActiveThreadId(newThread.id);
  };

  // 删除会话（只是 UI 操作）
  const handleDeleteThread = (id: string) => {
    setThreads(prev => prev.filter(t => t.id !== id));
    if (activeThreadId === id && threads.length > 1) {
      setActiveThreadId(threads.find(t => t.id !== id)?.id || '');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 border-r flex flex-col bg-muted/30">
        <div className="p-3 border-b flex items-center justify-between">
          <span className="font-semibold text-sm">Assistant</span>
        </div>
        
        {/* New Thread */}
        <button
          onClick={handleNewThread}
          className="m-2 p-2 flex items-center gap-2 rounded-lg border border-dashed hover:bg-muted text-sm"
        >
          <Plus className="size-4" />
          New Thread
        </button>
        
        {/* Thread List (Mock) */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {threads.map(thread => (
            <div
              key={thread.id}
              className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm ${
                activeThreadId === thread.id ? 'bg-accent' : 'hover:bg-muted'
              }`}
              onClick={() => setActiveThreadId(thread.id)}
            >
              <div className="flex items-center gap-2 truncate">
                <MessageSquare className="size-4 shrink-0" />
                <span className="truncate">{thread.title}</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteThread(thread.id); }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 hover:text-destructive rounded"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
        </div>
      </aside>
      
      {/* Main */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-12 border-b flex items-center justify-between px-4">
          <span className="text-sm text-muted-foreground">Chat</span>
          <TooltipIconButton tooltip="Close" variant="ghost" onClick={onClose}>
            <X className="size-4" />
          </TooltipIconButton>
        </header>
        
        {/* Thread (复用) */}
        <div className="flex-1 overflow-hidden">
          <Thread />
        </div>
      </main>
    </div>
  );
};
```

### Step 4: Canvas 集成

修改：`src/pages/Canvas.tsx`

```tsx
import { useState } from 'react';
import { AssistantModal } from '@/components/assistant-ui/assistant-modal';
import { AssistantFullscreen } from '@/components/assistant-ui/assistant-fullscreen';
import { MockRuntimeProvider } from '@/components/assistant-ui/mock-runtime-provider';

// 在 Canvas 组件中添加状态
const [isFullscreen, setIsFullscreen] = useState(false);

// 在 return 中
<TooltipProvider>
  <MockRuntimeProvider>
    {/* Modal 模式 */}
    {!isFullscreen && (
      <AssistantModal onExpand={() => setIsFullscreen(true)} />
    )}
    
    {/* 全屏模式 */}
    <AssistantFullscreen
      isOpen={isFullscreen}
      onClose={() => setIsFullscreen(false)}
    />
  </MockRuntimeProvider>
</TooltipProvider>
```

## 验收标准

### Phase 1
- [ ] Modal 有标题栏（标题 + 3 个按钮）
- [ ] 拖动标题栏可移动 Modal
- [ ] Modal 可 resize（右下角拖动）
- [ ] 放大按钮可切换到全屏
- [ ] 关闭按钮可关闭 Modal

### Phase 2
- [ ] 全屏模式覆盖整个视窗
- [ ] 左侧显示会话列表（Mock 数据）
- [ ] 可以点击"New Thread"添加新会话
- [ ] 可以点击切换不同会话（UI 选中状态变化）
- [ ] 可以删除会话
- [ ] 右侧显示 Thread 组件
- [ ] 关闭按钮返回 Modal 模式
- [ ] Echo 功能正常工作（MockRuntime）

## 技术要点

### 拖动实现（无依赖）

```tsx
const [position, setPosition] = useState({ x: 16, y: 100 });
const [isDragging, setIsDragging] = useState(false);
const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

const handleMouseDown = (e: React.MouseEvent) => {
  setIsDragging(true);
  setDragOffset({ x: e.clientX - position.x, y: e.clientY - position.y });
};

useEffect(() => {
  if (!isDragging) return;
  
  const handleMouseMove = (e: MouseEvent) => {
    setPosition({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });
  };
  const handleMouseUp = () => setIsDragging(false);
  
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
  return () => {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  };
}, [isDragging, dragOffset]);
```

### Resize 实现（CSS 方式）

```tsx
<div className="resize overflow-auto" style={{ minWidth: 300, minHeight: 400 }}>
  ...
</div>
```

或者自定义 resize handle。

## 不要做的事情

- ❌ 不要修改 `mock-runtime-provider.tsx`
- ❌ 不要引入真正的 AI 模型调用
- ❌ 不要实现复杂的持久化（localStorage 可选，但不强求）
- ❌ 不要修改 `Thread.tsx`
- ❌ 不要安装额外的拖动/resize 库（除非确实需要）

## 预期文件结构

```
src/components/assistant-ui/
├── assistant-modal.tsx       # 修改：添加标题栏、拖动、resize、onExpand
├── assistant-fullscreen.tsx  # 新增：全屏模式 UI
├── modal-header.tsx          # 新增：标题栏组件
├── thread.tsx                # 不修改
├── mock-runtime-provider.tsx # 不修改
└── ... 其他文件不修改
```

## 开始实现

分两阶段进行：
1. Phase 1：增强 Modal（标题栏 + 拖动 + resize）
2. Phase 2：全屏模式 UI

保持 UI 简洁，所有数据用 React useState 管理即可。
