/**
 * Thread History Adapter for message persistence.
 * Used with useLocalRuntime to handle per-thread message storage.
 */

import type { ThreadHistoryAdapter, ExportedMessageRepository } from '@assistant-ui/react';
import { readThread, writeThread, readIndex, writeIndex } from './storage';
import type { ThreadData } from './types';

/**
 * Create a ThreadHistoryAdapter for a specific thread.
 * 
 * @param threadId - The remote thread ID (will be assigned after initialize())
 */
export function createThreadHistoryAdapter(
    threadId: string | undefined
): ThreadHistoryAdapter {
    // Track the current thread ID (may be set later via initialize)
    let currentThreadId = threadId;

    return {
        async load(): Promise<ExportedMessageRepository> {
            console.log('[ThreadHistoryAdapter] load() called, threadId:', currentThreadId);

            if (!currentThreadId) {
                console.log('[ThreadHistoryAdapter] No threadId, returning empty');
                return { messages: [] };
            }

            const thread = await readThread(currentThreadId);
            console.log('[ThreadHistoryAdapter] thread loaded:', thread?.id, 'messages:', thread?.messages?.length);

            if (!thread) {
                return { messages: [] };
            }

            // Messages are already stored in ExportedMessageRepository format
            return { messages: thread.messages } as ExportedMessageRepository;
        },

        async append(message) {
            console.log('[ThreadHistoryAdapter] append() called, threadId:', currentThreadId);

            if (!currentThreadId) {
                console.warn('[ThreadHistoryAdapter] No threadId, skipping append');
                return;
            }

            let thread = await readThread(currentThreadId);
            if (!thread) {
                // Thread doesn't exist yet, create it
                const now = new Date().toISOString();
                thread = {
                    id: currentThreadId,
                    title: 'New Chat',
                    createdAt: now,
                    updatedAt: now,
                    messages: [],
                };
            }

            // Append the message (already in correct format from assistant-ui)
            thread.messages.push(message as unknown);
            thread.updatedAt = new Date().toISOString();
            await writeThread(thread);

            // Update index metadata
            await updateIndexMetadata(currentThreadId, thread);
        },
    };
}

/**
 * Update the thread metadata in index.json
 */
async function updateIndexMetadata(
    threadId: string,
    thread: ThreadData
): Promise<void> {
    const index = await readIndex();
    const meta = index.threads.find((t) => t.id === threadId);

    if (meta) {
        meta.messageCount = thread.messages.length;
        meta.updatedAt = thread.updatedAt;

        // Extract last message preview
        const lastEntry = thread.messages[thread.messages.length - 1] as {
            message?: { content?: Array<{ type: string; text?: string }> }
        } | undefined;

        if (lastEntry?.message?.content) {
            const textContent = lastEntry.message.content
                .filter((c) => c.type === 'text')
                .map((c) => c.text ?? '')
                .join('');
            meta.lastMessage = textContent.slice(0, 100);
        }

        await writeIndex(index);
    }
}
