# ChatModelAdapter 使用示例

## 概述

`ChatModelAdapter` 是一个统一的聊天接口，允许任何支持聊天功能的模型插件提供流式对话能力。

## 架构

```
UI Layer (Chat Component)
    ↓
ChatModelAdapter (统一接口)
    ↓
ModelPlugin.getChatAdapter() (各模型自行实现)
```

## 类型定义

```typescript
// Thread message format
interface ThreadMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

// Adapter run result
interface ChatModelRunResult {
    content: Array<
        | { type: 'text'; text: string }
        | { type: 'tool-call'; toolCallId: string; toolName: string; args: any; result?: any }
    >;
}

// The adapter interface
interface ChatModelAdapter {
    run(options: {
        messages: ThreadMessage[];
        abortSignal?: AbortSignal;
        config?: Record<string, any>;
    }): AsyncGenerator<ChatModelRunResult> | Promise<ChatModelRunResult>;
}
```

## Gemini 实现示例

```typescript
// src/features/models/google/google.tsx
getChatAdapter: (credentials, modelConfig) => ({
    async *run({ messages, abortSignal, config: runtimeConfig }) {
        const google = createGoogleGenerativeAI({
            apiKey: credentials.apiKey,
            baseURL: credentials.baseUrl?.includes('generativelanguage.googleapis.com')
                ? undefined
                : credentials.baseUrl,
        });

        const model = google(config.id);

        // Convert ThreadMessage to AI SDK message format
        const aiMessages = messages.map(msg => ({
            role: msg.role,
            content: msg.content,
        }));

        const result = streamText({
            model,
            messages: aiMessages,
            temperature: runtimeConfig?.temperature ?? modelConfig?.temperature ?? 0.7,
            maxOutputTokens: runtimeConfig?.maxTokens ?? modelConfig?.maxTokens ?? config.maxOutputTokens,
            abortSignal,
        });

        // Stream text chunks
        for await (const chunk of result.textStream) {
            yield { content: [{ type: 'text', text: chunk }] };
        }
    }
}),
```

## UI 层使用示例

```typescript
import { modelRegistry } from '@/features/models';
import { useCredentials } from '@/hooks/useCredentials';
import { useState, useEffect } from 'react';

function ChatComponent({ modelId }: { modelId: string }) {
    const [messages, setMessages] = useState<ThreadMessage[]>([]);
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);
    
    const model = modelRegistry.get(modelId);
    const credentials = useCredentials(model?.provider);
    
    const handleSend = async () => {
        if (!model?.getChatAdapter || !credentials) return;
        
        // Add user message
        const userMessage: ThreadMessage = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setStreaming(true);
        
        try {
            // Get adapter
            const adapter = model.getChatAdapter(credentials, {
                temperature: 0.7,
                maxTokens: 2048,
            });
            
            // Run streaming chat
            let assistantText = '';
            for await (const chunk of adapter.run({
                messages: [...messages, userMessage],
                abortSignal: new AbortController().signal,
            })) {
                for (const item of chunk.content) {
                    if (item.type === 'text') {
                        assistantText += item.text;
                        // Update UI in real-time
                        setMessages(prev => {
                            const last = prev[prev.length - 1];
                            if (last?.role === 'assistant') {
                                return [...prev.slice(0, -1), { role: 'assistant', content: assistantText }];
                            }
                            return [...prev, { role: 'assistant', content: assistantText }];
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Chat error:', error);
        } finally {
            setStreaming(false);
        }
    };
    
    return (
        <div>
            {/* Chat UI implementation */}
        </div>
    );
}
```

## 优势

1. **统一接口**: 所有模型使用相同的 `ChatModelAdapter` 接口
2. **模型自治**: 每个模型自行决定如何实现聊天（直连 API、Rust 代理等）
3. **流式支持**: 支持异步生成器，实现真正的流式响应
4. **可扩展**: 支持工具调用（tool-call）等高级功能
5. **类型安全**: 完整的 TypeScript 类型定义

## 下一步

其他模型（OpenAI, Anthropic, DeepSeek 等）可以类似实现 `getChatAdapter` 方法。
