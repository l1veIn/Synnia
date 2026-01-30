# 任务：Chat Runtime 业务层集成 - Phase 1

## 目标

将 assistant-ui 的 `useLocalRuntime` 与现有的 `ChatModelAdapter` 连接，实现真正的 AI 聊天功能。

**Phase 1 范围：**
- ✅ 接通 Gemini 模型（使用现有的 `getChatAdapter`）
- ✅ 模型选择器 UI
- ✅ credentials 获取
- ❌ 无持久化（刷新后消息丢失）
- ❌ 无历史管理
- ❌ 其他模型暂不实现

## 项目背景

### 已完成

1. **UI 层** (`src/components/assistant-ui/`)
   - `AssistantModal` - 浮动 Modal 聊天窗口
   - `AssistantFullscreen` - 全屏聊天模式
   - `Thread` - 聊天线程 UI
   - `MockRuntimeProvider` - Mock Echo 机器人（将被替换）

2. **模型层** (`src/features/models/`)
   - `ModelPlugin` 接口 + `modelRegistry`
   - Gemini 已实现 `getChatAdapter` 方法
   - `getProviderCredentials` 获取 API 密钥

### 当前架构

```
Canvas.tsx
└── MockRuntimeProvider  ← 需要替换为真实 Runtime
    ├── AssistantModal
    └── AssistantFullscreen
```

### 目标架构

```
Canvas.tsx
└── ChatRuntimeProvider  ← 新建，使用 useLocalRuntime
    ├── AssistantModal
    └── AssistantFullscreen
```

## 核心实现

### 1. 创建 Chat 模块

位置：`src/features/chat/`

```
src/features/chat/
├── index.ts                    # 导出
├── ChatRuntimeProvider.tsx     # Runtime Provider 组件
├── useChatModelAdapter.ts      # 获取当前模型的 ChatModelAdapter
└── useChatModelSelector.ts     # 模型选择状态管理
```

### 2. ChatRuntimeProvider

文件：`src/features/chat/ChatRuntimeProvider.tsx`

```tsx
"use client";

import { ReactNode } from 'react';
import { AssistantRuntimeProvider, useLocalRuntime } from '@assistant-ui/react';
import { useChatModelAdapter } from './useChatModelAdapter';

interface ChatRuntimeProviderProps {
  children: ReactNode;
}

export function ChatRuntimeProvider({ children }: ChatRuntimeProviderProps) {
  // 获取当前选中模型的 ChatModelAdapter
  const adapter = useChatModelAdapter();
  
  // 使用 assistant-ui 的 useLocalRuntime
  const runtime = useLocalRuntime(adapter);
  
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
```

### 3. useChatModelAdapter Hook

文件：`src/features/chat/useChatModelAdapter.ts`

关键点：
1. 读取用户选择的模型（从状态管理或 localStorage）
2. 从 `modelRegistry` 获取 `ModelPlugin`
3. 调用 `getChatAdapter(credentials, config)` 获取适配器
4. 处理模型不支持 chat 的情况

```tsx
import { useMemo } from 'react';
import { modelRegistry } from '@/features/models';
import { loadSettings, getProviderCredentials } from '@/lib/settings';
import { useChatModelSelector } from './useChatModelSelector';

export function useChatModelAdapter() {
  const { selectedModelId } = useChatModelSelector();
  
  const adapter = useMemo(() => {
    // 1. 获取模型
    const model = modelRegistry.get(selectedModelId);
    if (!model) {
      console.warn(`Model ${selectedModelId} not found`);
      return createFallbackAdapter();
    }
    
    // 2. 检查是否支持 chat
    if (!model.getChatAdapter) {
      console.warn(`Model ${selectedModelId} does not support chat`);
      return createFallbackAdapter();
    }
    
    // 3. 获取 credentials
    const settings = loadSettings();
    const provider = model.provider || model.supportedProviders?.[0];
    const creds = getProviderCredentials(settings, provider);
    
    if (!creds?.apiKey) {
      console.warn(`No credentials for provider ${provider}`);
      return createFallbackAdapter();
    }
    
    // 4. 返回真实适配器
    return model.getChatAdapter(creds, {
      temperature: 0.7,
      maxTokens: 4096,
    });
  }, [selectedModelId]);
  
  return adapter;
}

// Fallback adapter (error message)
function createFallbackAdapter() {
  return {
    async *run() {
      yield { 
        content: [{ 
          type: 'text' as const, 
          text: '⚠️ Model not configured. Please select a model and configure API credentials.' 
        }] 
      };
    }
  };
}
```

### 4. useChatModelSelector Hook

文件：`src/features/chat/useChatModelSelector.ts`

管理当前选中的模型，可以用 Zustand 或简单的 useState + localStorage：

```tsx
import { useState, useEffect } from 'react';
import { modelRegistry } from '@/features/models';

const STORAGE_KEY = 'synnia-chat-model';
const DEFAULT_MODEL = 'gemini-2.5-flash';

export function useChatModelSelector() {
  const [selectedModelId, setSelectedModelId] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved || DEFAULT_MODEL;
  });
  
  // 保存到 localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, selectedModelId);
  }, [selectedModelId]);
  
  // 获取可用的聊天模型
  const availableModels = modelRegistry
    .getAll()
    .filter(m => m.getChatAdapter && m.capabilities?.includes('chat'));
  
  return {
    selectedModelId,
    setSelectedModelId,
    availableModels,
  };
}
```

### 5. 模型选择器 UI

**重要参考**：`src/components/workflow/nodes/RecipeNode/Inspector/ModelTab.tsx`

该文件包含完整的模型选择器实现，可复用以下逻辑：

#### 可复用的逻辑

```tsx
// 1. 获取用户配置的提供商
import { useSettings, ProviderKey, isProviderConfigured } from '@/lib/settings';
import { PROVIDER_INFO } from '@features/models/providers';

const { settings } = useSettings();
const configuredProviders = useMemo(() => {
  const providers: ProviderType[] = [];
  if (settings) {
    PROVIDER_INFO.map(p => p.key).forEach(key => {
      if (isProviderConfigured(settings, key as ProviderKey)) {
        providers.push(key as ProviderType);
      }
    });
  }
  return providers;
}, [settings]);

// 2. 过滤支持 chat 的模型
const models = useMemo(() => {
  return modelRegistry
    .getByCategory('llm')
    .filter(m => m.getChatAdapter);  // 只显示支持 chat 的模型
}, []);

// 3. 检查模型的 provider 是否已配置
const isProviderAvailable = configuredProviders.includes(selectedModel?.provider);
```

#### 可复用的 UI 组件

ModelTab 使用了 `Command` + `Popover` 组件实现搜索下拉框：

```tsx
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

<Popover open={open} onOpenChange={setOpen}>
  <PopoverTrigger asChild>
    <Button variant="outline" className="w-full justify-between">
      {selectedModel ? (
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{selectedModel.provider}</Badge>
          <span>{selectedModel.name}</span>
        </div>
      ) : (
        <span>Select model...</span>
      )}
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-[280px] p-0">
    <Command>
      <CommandInput placeholder="Search models..." />
      <CommandList>
        <CommandEmpty>No models found</CommandEmpty>
        <CommandGroup>
          {models.map(model => {
            const hasProvider = configuredProviders.includes(model.provider);
            return (
              <CommandItem
                key={model.id}
                disabled={!hasProvider}
                onSelect={() => setSelectedModelId(model.id)}
              >
                {model.name}
                <span className={hasProvider ? 'text-green-500' : 'text-muted-foreground'}>
                  {model.provider}
                </span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>
```

#### 无 API Key 的空状态

```tsx
import { openSettingsDialog } from '@/components/settings/SettingsDialog';

{configuredProviders.length === 0 && (
  <div className="flex flex-col items-center justify-center py-8">
    <Key className="h-6 w-6 text-muted-foreground mb-4" />
    <h3>No API Keys configured</h3>
    <Button onClick={() => openSettingsDialog('models')}>
      Open Settings
    </Button>
  </div>
)}
```

#### 简化版本（如果不需要搜索）

```tsx
import { useChatModelSelector } from '@/features/chat';

const { selectedModelId, setSelectedModelId, availableModels } = useChatModelSelector();

<select 
  value={selectedModelId} 
  onChange={(e) => setSelectedModelId(e.target.value)}
>
  {availableModels.map(model => (
    <option key={model.id} value={model.id}>{model.name}</option>
  ))}
</select>
```

### 6. 替换 Canvas 中的 Provider

修改：`src/pages/Canvas.tsx`

```tsx
// Before
import { MockRuntimeProvider } from '@/components/assistant-ui/mock-runtime-provider';

// After
import { ChatRuntimeProvider } from '@/features/chat';

// 在 JSX 中
<TooltipProvider>
  <ChatRuntimeProvider>  {/* 替换 MockRuntimeProvider */}
    {!isFullscreen && (
      <AssistantModal ... />
    )}
    <AssistantFullscreen ... />
  </ChatRuntimeProvider>
</TooltipProvider>
```

## 类型适配

### assistant-ui 的 ChatModelAdapter 接口

```tsx
// assistant-ui 期望的接口
interface ChatModelAdapter {
  run(options: {
    messages: readonly ThreadMessage[];
    abortSignal: AbortSignal;
    config?: Record<string, unknown>;
  }): AsyncGenerator<ChatModelRunResult> | Promise<ChatModelRunResult>;
}

interface ThreadMessage {
  role: 'user' | 'assistant' | 'system';
  content: ThreadMessageContent[];  // 注意：是数组
}

interface ChatModelRunResult {
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'tool-call'; toolCallId: string; toolName: string; args: unknown }
  >;
}
```

### 你的 ChatModelAdapter 接口

```tsx
// src/features/models/types.ts
interface ChatModelAdapter {
  run(options: {
    messages: ThreadMessage[];
    abortSignal?: AbortSignal;
    config?: Record<string, any>;
  }): AsyncGenerator<ChatModelRunResult> | Promise<ChatModelRunResult>;
}

interface ThreadMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;  // 注意：是字符串
}
```

### 需要调整的类型

将 `src/features/models/types.ts` 中的 `ThreadMessage` 改为与 assistant-ui 一致：

```tsx
export interface ThreadMessage {
  role: 'user' | 'assistant' | 'system';
  content: Array<{ type: 'text'; text: string } | { type: 'image'; image: string }>;
}
```

或者在业务层做转换。**推荐直接修改类型定义以避免技术债。**

## Gemini getChatAdapter 调整

如果修改了 `ThreadMessage` 类型，需要更新 Gemini 的 `getChatAdapter`：

```tsx
// src/features/models/google/google.tsx
getChatAdapter: (credentials, modelConfig) => ({
  async *run({ messages, abortSignal, config: runtimeConfig }) {
    // ... 创建 Google 客户端 ...
    
    // 转换消息格式（ThreadMessage[] -> AI SDK 格式）
    const aiMessages = messages.map(msg => ({
      role: msg.role,
      // 提取文本内容
      content: msg.content
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join(''),
    }));
    
    const result = streamText({
      model,
      messages: aiMessages,
      temperature: runtimeConfig?.temperature ?? modelConfig?.temperature ?? 0.7,
      maxOutputTokens: runtimeConfig?.maxTokens ?? modelConfig?.maxTokens,
      abortSignal,
    });
    
    for await (const chunk of result.textStream) {
      yield { content: [{ type: 'text', text: chunk }] };
    }
  }
}),
```

## 验收标准

- [ ] `src/features/chat/` 目录创建完成
- [ ] `ChatRuntimeProvider` 替换 `MockRuntimeProvider`
- [ ] 输入消息后能收到 Gemini 的真实回复
- [ ] 流式响应正常工作（逐字显示）
- [ ] 模型选择器可切换模型（虽然目前只有 Gemini 支持）
- [ ] 无 API key 时显示友好错误提示
- [ ] 控制台无报错

## 注意事项

1. **只改 Phase 1 范围内的代码**：不要提前实现持久化
2. **保留 MockRuntimeProvider**：可能后续测试还需要
3. **只有 Gemini 有 getChatAdapter**：其他模型选中时应显示 fallback 消息
4. **Credentials 缺失处理**：给用户友好提示而不是崩溃

## 预期文件结构

```
src/features/chat/
├── index.ts
├── ChatRuntimeProvider.tsx
├── useChatModelAdapter.ts
└── useChatModelSelector.ts

src/features/models/types.ts  # 修改 ThreadMessage 类型
src/features/models/google/google.tsx  # 调整 getChatAdapter
src/pages/Canvas.tsx  # 替换 Provider
```

## 开始实现

1. 先创建 `src/features/chat/` 模块
2. 修改类型定义（如需要）
3. 更新 Gemini getChatAdapter（如需要）
4. 替换 Canvas 中的 Provider
5. 测试真实聊天功能
