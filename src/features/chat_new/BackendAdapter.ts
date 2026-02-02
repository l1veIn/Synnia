/**
 * BackendAdapter - Tauri backend chat adapter for agent_new module.
 *
 * This adapter calls the Rust backend `chat_stream_command` and listens for
 * streaming events. It implements chronological content ordering to ensure
 * proper rendering of mixed text and tool-call content parts.
 *
 * Reference: src/features/chat/BackendChatModelAdapter.ts
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { ChatModelAdapter, ChatModelRunOptions, ChatModelRunResult } from '@assistant-ui/react';
import type { StreamEvent } from './types';

export interface BackendAdapterOptions {
  modelId: string;
  provider: string;
  threadId?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ContentPart = any;

/**
 * Creates a ChatModelAdapter that communicates with the Rust backend.
 *
 * The adapter:
 * 1. Calls the backend `chat_stream_command` with the message
 * 2. Listens for streaming events on `agent-stream-{thread_id}`
 * 3. Maintains chronological ordering of content parts (text and tool-calls)
 * 4. Yields updates to the assistant-ui runtime
 *
 * @param options - Adapter configuration
 * @returns ChatModelAdapter for use with assistant-ui
 */
export function createBackendAdapter(options: BackendAdapterOptions): ChatModelAdapter {
  const { modelId, provider, threadId } = options;

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
      const pendingEvents: StreamEvent[] = [];
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
        contentIndex: number;
      }
      const toolCallsByName = new Map<string, ToolCallState>();
      let toolCallCounter = 0;

      // Helper to get current content snapshot
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const getContent = (): any[] => [...contentParts];

      try {
        // Call backend to start streaming
        const returnedThreadId = await invoke<string>('chat_stream_command', {
          request: {
            threadId: threadId,
            content: textContent,
            modelId,
            provider,
            supportsStreaming: true,
          },
        });

        const eventName = `agent-stream-${returnedThreadId}`;
        console.log(`[BackendAdapter] Listening for events on: ${eventName}`);

        // Set up event listener
        unlisten = await listen<StreamEvent>(eventName, (event) => {
          const payload = event.payload;
          console.log(`[BackendAdapter] Received event:`, payload);

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
                const existing = contentParts[currentTextPartIndex];
                if (existing.type === 'text') {
                  contentParts[currentTextPartIndex] = {
                    type: 'text',
                    text: existing.text + event.text,
                  };
                }
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
                toolName: event.name,
                args,
                argsText: event.args,
              });

              // Track for result update
              toolCallsByName.set(`${event.name}_${toolCallId}`, {
                toolCallId,
                toolName: event.name,
                contentIndex,
              });

              console.log(`[BackendAdapter] Tool call: ${event.name}`, args);
              yield { content: getContent() };
            } else if (event.type === 'toolResult') {
              // Update existing tool call part with result
              // Try to find by tool name first, then by id
              let tracked: ToolCallState | undefined;
              for (const [key, state] of toolCallsByName.entries()) {
                if (state.toolName === event.name || key.includes(event.id)) {
                  tracked = state;
                  break;
                }
              }

              if (tracked && contentParts[tracked.contentIndex]) {
                let result: unknown;
                try {
                  result = JSON.parse(event.result);
                } catch {
                  result = event.result;
                }
                contentParts[tracked.contentIndex].result = result;
                console.log(`[BackendAdapter] Tool result: ${event.name}`, result);
                yield { content: getContent() };
              }
            } else if (event.type === 'error') {
              yield {
                content: [{ type: 'text', text: `❌ Error: ${event.message}` }],
                status: { type: 'incomplete', reason: 'error' },
              };
              return;
            } else if (event.type === 'complete') {
              // Ensure at least one content part exists
              const finalContent = contentParts.length > 0
                ? getContent()
                : [{ type: 'text', text: '' }];
              // Final yield with complete status
              yield {
                content: finalContent,
                status: { type: 'complete', reason: 'stop' },
              };
              return;
            }
          }

          // Check abort
          if (abortSignal?.aborted) {
            // Ensure at least one content part exists
            const abortContent = contentParts.length > 0
              ? getContent()
              : [{ type: 'text', text: '' }];
            yield {
              content: abortContent,
              status: { type: 'incomplete', reason: 'cancelled' },
            };
            return;
          }
        }

      } catch (error) {
        console.error('[BackendAdapter] Error:', error);
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
