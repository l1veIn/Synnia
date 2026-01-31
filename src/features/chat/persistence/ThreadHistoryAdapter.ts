/**
 * ThreadHistoryAdapter - Handles message persistence for threads.
 * Provides both dynamic (deprecated) and thread-bound adapters.
 */

import type {
    ThreadHistoryAdapter,
    ExportedMessageRepository,
    ExportedMessageRepositoryItem,
} from '@assistant-ui/react';
import { readIndex, readThread, writeIndex, writeThread } from './storage';
import type { ThreadData } from './types';

/**
 * Creates a history adapter bound to a specific thread ID.
 * This is the correct pattern for per-thread message persistence.
 * 
 * @param threadId - The remote thread ID to bind to (may be undefined for new threads)
 */
export function createThreadBoundHistoryAdapter(threadId: string | undefined): ThreadHistoryAdapter {
    // Capture the threadId at creation time - it won't change for this adapter instance
    const boundThreadId = threadId;

    return {
        /** Load messages for the bound thread */
        async load(): Promise<ExportedMessageRepository> {
            if (!boundThreadId) {
                console.log('[ThreadHistoryAdapter] No thread ID - returning empty (new thread)');
                return { messages: [] };
            }

            const thread = await readThread(boundThreadId);
            if (!thread || !thread.messages.length) {
                return { messages: [] };
            }

            console.log(`[ThreadHistoryAdapter] Loaded ${thread.messages.length} messages for thread ${boundThreadId}`);

            // Convert stored messages to ExportedMessageRepository format
            const exportedMessages: ExportedMessageRepository['messages'] = [];
            let lastId: string | null = null;

            for (const msg of thread.messages) {
                const typedMsg = msg as { id: string;[key: string]: unknown };
                exportedMessages.push({
                    message: msg as ExportedMessageRepositoryItem['message'],
                    parentId: lastId,
                });
                lastId = typedMsg.id;
            }

            return {
                headId: lastId,
                messages: exportedMessages,
            };
        },

        /** Append a message when it completes */
        async append(item: ExportedMessageRepositoryItem): Promise<void> {
            if (!boundThreadId) {
                console.warn('[ThreadHistoryAdapter] Cannot append - no bound thread ID (new thread not yet initialized)');
                return;
            }

            const thread = await readThread(boundThreadId);
            if (!thread) {
                console.warn(`[ThreadHistoryAdapter] Thread ${boundThreadId} not found`);
                return;
            }

            // Store the message itself
            thread.messages.push(item.message as ThreadData['messages'][0]);
            thread.updatedAt = new Date().toISOString();
            await writeThread(thread);

            console.log(`[ThreadHistoryAdapter] Appended message to thread ${boundThreadId}, total: ${thread.messages.length}`);

            // Update index metadata
            const index = await readIndex();
            const meta = index.threads.find(t => t.id === boundThreadId);
            if (meta) {
                meta.messageCount = thread.messages.length;
                meta.updatedAt = thread.updatedAt;

                // Update last message preview
                const content = (item.message as unknown as { content?: readonly { type: string; text?: string }[] }).content;
                if (content && Array.isArray(content)) {
                    const lastContent = content
                        .filter((c): c is { type: 'text'; text: string } =>
                            c.type === 'text' && 'text' in c && typeof c.text === 'string'
                        )
                        .map(c => c.text)
                        .join('');
                    meta.lastMessage = lastContent.slice(0, 100);
                }

                await writeIndex(index);
            }
        },
    };
}

/**
 * @deprecated Use createThreadBoundHistoryAdapter instead.
 * Creates a history adapter that dynamically resolves the current thread ID.
 * This pattern is problematic when threads switch - use bound adapters instead.
 */
export function createDynamicThreadHistoryAdapter(): ThreadHistoryAdapter & {
    __internal_setGetThreadId(fn: () => string | undefined): void;
} {
    let getThreadId: (() => string | undefined) | undefined;

    return {
        __internal_setGetThreadId(fn: () => string | undefined) {
            getThreadId = fn;
        },

        async load(): Promise<ExportedMessageRepository> {
            const threadId = getThreadId?.();
            if (!threadId) {
                return { messages: [] };
            }
            // Delegate to bound adapter
            return createThreadBoundHistoryAdapter(threadId).load();
        },

        async append(item: ExportedMessageRepositoryItem): Promise<void> {
            const threadId = getThreadId?.();
            if (!threadId) {
                console.warn('[ThreadHistoryAdapter] Cannot append - no thread ID');
                return;
            }
            // Delegate to bound adapter
            return createThreadBoundHistoryAdapter(threadId).append(item);
        },
    };
}
