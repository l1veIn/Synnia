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

interface StreamEventComplete {
    type: 'complete';
}

interface StreamEventError {
    type: 'error';
    message: string;
}

type StreamEvent = StreamEventToken | StreamEventComplete | StreamEventError;

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
            let accumulatedText = '';
            let resolveNext: (() => void) | null = null;
            let pendingEvents: StreamEvent[] = [];
            let isComplete = false;
            let errorMessage: string | null = null;

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
                            accumulatedText += event.text;
                            yield {
                                content: [{ type: 'text', text: accumulatedText }],
                            };
                        } else if (event.type === 'error') {
                            yield {
                                content: [{ type: 'text', text: `❌ Error: ${event.message}` }],
                                status: { type: 'incomplete', reason: 'error' },
                            };
                            return;
                        } else if (event.type === 'complete') {
                            // Final yield with complete status
                            yield {
                                content: [{ type: 'text', text: accumulatedText }],
                                status: { type: 'complete', reason: 'stop' },
                            };
                            return;
                        }
                    }

                    // Check abort
                    if (abortSignal?.aborted) {
                        yield {
                            content: [{ type: 'text', text: accumulatedText }],
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
