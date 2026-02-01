/**
 * BackendChatModelAdapter - Phase 8
 * 
 * Calls the Rust backend `chat_stream` command and listens for streaming events.
 * This replaces the frontend AI SDK direct calls (getChatAdapter in google.tsx etc).
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { ChatModelAdapter, ChatModelRunOptions, ChatModelRunResult } from '@assistant-ui/react';

// StreamEvent types matching backend StreamEvent in engine.rs
// Backend uses #[serde(rename_all = "camelCase")]
interface StreamEventToken {
    type: 'token';
    text: string;
}

interface StreamEventToolCall {
    type: 'toolCall';
    toolName: string;
    args: string; // JSON string
}

interface StreamEventToolResult {
    type: 'toolResult';
    toolName: string;
    result: string; // JSON string
}

interface StreamEventComplete {
    type: 'complete';
}

interface StreamEventError {
    type: 'error';
    message: string;
}

type StreamEvent = StreamEventToken | StreamEventToolCall | StreamEventToolResult | StreamEventComplete | StreamEventError;

export interface BackendChatAdapterOptions {
    modelId: string;
    provider: string;
    sessionId?: string;
}

/**
 * Creates a ChatModelAdapter that communicates with the Rust backend.
 */
export function createBackendChatAdapter(options: BackendChatAdapterOptions): ChatModelAdapter {
    const { modelId, provider, sessionId } = options;

    return {
        async *run(runOptions: ChatModelRunOptions): AsyncGenerator<ChatModelRunResult, void> {
            const { messages, abortSignal } = runOptions;

            // Get the last user message content
            const lastMessage = messages[messages.length - 1];
            if (!lastMessage || lastMessage.role !== 'user') {
                yield {
                    content: [{ type: 'text', text: '⚠️ No user message found.' }],
                };
                return;
            }

            // Extract text content from the message
            const textContent = lastMessage.content
                .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
                .map(part => part.text)
                .join('\n');

            if (!textContent) {
                yield {
                    content: [{ type: 'text', text: '⚠️ Empty message.' }],
                };
                return;
            }

            let unlisten: UnlistenFn | null = null;
            let resolveNext: (() => void) | null = null;
            let pendingEvents: StreamEvent[] = [];
            let isComplete = false;
            let errorMessage: string | null = null;

            // Track content parts in chronological order
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const contentParts: any[] = [];

            // Current text part index (-1 means no current text part)
            let currentTextPartIndex = -1;

            // Tool call tracking for updating results
            interface ToolCallState {
                toolCallId: string;
                toolName: string;
                contentIndex: number; // index in contentParts array
            }
            const toolCallsByName = new Map<string, ToolCallState>();
            let toolCallCounter = 0;

            // Helper to get current content snapshot
            const getContent = () => [...contentParts];

            try {
                // Call backend to start streaming
                const returnedSessionId = await invoke<string>('chat_stream', {
                    sessionId: sessionId,
                    content: textContent,
                    modelId: modelId,
                    provider: provider,
                });

                const eventName = `chat-stream-${returnedSessionId}`;
                console.log(`[BackendChatAdapter] Listening for events on: ${eventName}`);

                // Set up event listener
                unlisten = await listen<StreamEvent>(eventName, (event) => {
                    const payload = event.payload;
                    console.log(`[BackendChatAdapter] Received event:`, payload);

                    pendingEvents.push(payload);

                    if (payload.type === 'complete' || payload.type === 'error') {
                        isComplete = true;
                        if (payload.type === 'error') {
                            errorMessage = payload.message;
                        }
                    }

                    // Wake up the generator if it's waiting
                    if (resolveNext) {
                        resolveNext();
                        resolveNext = null;
                    }
                });

                // Handle abort signal
                if (abortSignal) {
                    abortSignal.addEventListener('abort', () => {
                        isComplete = true;
                        if (resolveNext) {
                            resolveNext();
                            resolveNext = null;
                        }
                    });
                }

                // Process events as they come in
                while (!isComplete || pendingEvents.length > 0) {
                    // Wait for events if none pending
                    if (pendingEvents.length === 0 && !isComplete) {
                        await new Promise<void>((resolve) => {
                            resolveNext = resolve;
                        });
                    }

                    // Process all pending events
                    while (pendingEvents.length > 0) {
                        const event = pendingEvents.shift()!;

                        if (event.type === 'token') {
                            // Append to current text part or create new one
                            if (currentTextPartIndex >= 0 && contentParts[currentTextPartIndex]?.type === 'text') {
                                contentParts[currentTextPartIndex].text += event.text;
                            } else {
                                // Create new text part
                                currentTextPartIndex = contentParts.length;
                                contentParts.push({ type: 'text', text: event.text });
                            }
                            yield { content: getContent() };
                        } else if (event.type === 'toolCall') {
                            // Tool call interrupts current text - next text will be new part
                            currentTextPartIndex = -1;

                            // Create new tool-call part
                            const toolCallId = `tc_${++toolCallCounter}`;
                            let args: Record<string, unknown> = {};
                            try {
                                args = JSON.parse(event.args) as Record<string, unknown>;
                            } catch {
                                args = {};
                            }

                            const contentIndex = contentParts.length;
                            contentParts.push({
                                type: 'tool-call',
                                toolCallId,
                                toolName: event.toolName,
                                args,
                                argsText: event.args,
                            });

                            // Track for result update
                            toolCallsByName.set(event.toolName, {
                                toolCallId,
                                toolName: event.toolName,
                                contentIndex,
                            });

                            console.log(`[BackendChatAdapter] Tool call: ${event.toolName}`, args);
                            yield { content: getContent() };
                        } else if (event.type === 'toolResult') {
                            // Update existing tool call part with result
                            const tracked = toolCallsByName.get(event.toolName);
                            if (tracked && contentParts[tracked.contentIndex]) {
                                let result: unknown;
                                try {
                                    result = JSON.parse(event.result);
                                } catch {
                                    result = event.result;
                                }
                                contentParts[tracked.contentIndex].result = result;
                                console.log(`[BackendChatAdapter] Tool result: ${event.toolName}`, result);
                                yield { content: getContent() };
                            }
                        } else if (event.type === 'error') {
                            yield {
                                content: [{ type: 'text', text: `❌ Error: ${event.message}` }],
                                status: { type: 'incomplete', reason: 'error' },
                            };
                            return;
                        } else if (event.type === 'complete') {
                            // Final yield with complete status
                            yield {
                                content: getContent(),
                                status: { type: 'complete', reason: 'stop' },
                            };
                            return;
                        }
                    }

                    // Check abort
                    if (abortSignal?.aborted) {
                        yield {
                            content: getContent(),
                            status: { type: 'incomplete', reason: 'cancelled' },
                        };
                        return;
                    }
                }

            } catch (error) {
                console.error('[BackendChatAdapter] Error:', error);
                yield {
                    content: [{
                        type: 'text',
                        text: `❌ Backend error: ${error instanceof Error ? error.message : String(error)}`
                    }],
                    status: { type: 'incomplete', reason: 'error' },
                };
            } finally {
                if (unlisten) {
                    unlisten();
                }
            }
        },
    };
}
