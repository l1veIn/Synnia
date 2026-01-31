/**
 * ChatThreadListAdapter - RemoteThreadListAdapter implementation for JSON file persistence.
 * Implements the assistant-ui adapter interface to manage thread list operations.
 */

import type {
    unstable_RemoteThreadListAdapter as RemoteThreadListAdapter,
} from '@assistant-ui/react';
import type { AssistantStream, AssistantStreamChunk } from 'assistant-stream';
import { v4 as uuidv4 } from 'uuid';
import { readIndex, writeIndex, readThread, writeThread, deleteThread as deleteThreadFile } from './storage';
import type { ThreadData, ThreadMetadata } from './types';

export function createChatThreadListAdapter(): RemoteThreadListAdapter {
    return {
        /** List all threads */
        async list() {
            const index = await readIndex();
            return {
                threads: index.threads.map(t => ({
                    remoteId: t.id,
                    status: t.isArchived ? 'archived' as const : 'regular' as const,
                    title: t.title,
                })),
            };
        },

        /** Create a new thread (called when first message is sent) */
        async initialize(_threadId: string) {
            const id = uuidv4();
            const now = new Date().toISOString();

            // Create thread file
            const thread: ThreadData = {
                id,
                title: 'New Chat',
                createdAt: now,
                updatedAt: now,
                messages: [],
            };
            await writeThread(thread);

            // Update index
            const index = await readIndex();
            const metadata: ThreadMetadata = {
                id,
                title: 'New Chat',
                createdAt: now,
                updatedAt: now,
                isArchived: false,
                messageCount: 0,
            };
            index.threads.unshift(metadata);
            await writeIndex(index);

            return { remoteId: id, externalId: undefined };
        },

        /** Rename a thread */
        async rename(remoteId: string, title: string): Promise<void> {
            const now = new Date().toISOString();

            // Update index
            const index = await readIndex();
            const threadMeta = index.threads.find(t => t.id === remoteId);
            if (threadMeta) {
                threadMeta.title = title;
                threadMeta.updatedAt = now;
                await writeIndex(index);
            }

            // Update thread file
            const thread = await readThread(remoteId);
            if (thread) {
                thread.title = title;
                thread.updatedAt = now;
                await writeThread(thread);
            }
        },

        /** Archive a thread */
        async archive(remoteId: string): Promise<void> {
            const index = await readIndex();
            const threadMeta = index.threads.find(t => t.id === remoteId);
            if (threadMeta) {
                threadMeta.isArchived = true;
                threadMeta.updatedAt = new Date().toISOString();
                await writeIndex(index);
            }
        },

        /** Unarchive a thread */
        async unarchive(remoteId: string): Promise<void> {
            const index = await readIndex();
            const threadMeta = index.threads.find(t => t.id === remoteId);
            if (threadMeta) {
                threadMeta.isArchived = false;
                threadMeta.updatedAt = new Date().toISOString();
                await writeIndex(index);
            }
        },

        /** Delete a thread */
        async delete(remoteId: string): Promise<void> {
            // Delete file
            await deleteThreadFile(remoteId);

            // Update index
            const index = await readIndex();
            index.threads = index.threads.filter(t => t.id !== remoteId);
            await writeIndex(index);
        },

        /** Fetch thread details */
        async fetch(remoteId: string) {
            const index = await readIndex();
            const threadMeta = index.threads.find(t => t.id === remoteId);

            return {
                remoteId,
                status: threadMeta?.isArchived ? 'archived' as const : 'regular' as const,
                title: threadMeta?.title || 'Chat',
            };
        },

        /** Generate title from first user message (simple implementation without AI) */
        async generateTitle(
            remoteId: string,
            messages: readonly { role: string; content: readonly { type: string; text?: string }[] }[]
        ): Promise<AssistantStream> {
            // Simple implementation: use first user message (no AI)
            const firstUserMessage = messages.find(m => m.role === 'user');
            let title = 'New Chat';

            if (firstUserMessage) {
                const textContent = firstUserMessage.content
                    .filter(c => c.type === 'text' && c.text)
                    .map(c => c.text)
                    .join('');
                if (textContent.trim()) {
                    title = textContent.slice(0, 30) + (textContent.length > 30 ? '...' : '');
                }
            }

            // Directly update the title in storage
            const now = new Date().toISOString();
            const index = await readIndex();
            const threadMeta = index.threads.find(t => t.id === remoteId);
            if (threadMeta && title !== 'New Chat') {
                threadMeta.title = title;
                threadMeta.updatedAt = now;
                await writeIndex(index);

                // Also update thread file
                const thread = await readThread(remoteId);
                if (thread) {
                    thread.title = title;
                    thread.updatedAt = now;
                    await writeThread(thread);
                }
                console.log(`[ChatThreadListAdapter] Generated title for ${remoteId}: "${title}"`);
            }

            // Return a stream with the title text so UI updates in real-time
            // The framework reads parts with type "text" and extracts the text content
            const titleToStream = title !== 'New Chat' ? title : '';

            return new ReadableStream<AssistantStreamChunk>({
                start(controller) {
                    if (titleToStream) {
                        // Start a text part
                        controller.enqueue({
                            path: [0],
                            type: 'part-start',
                            part: { type: 'text' },
                        });
                        // Send the title as text delta
                        controller.enqueue({
                            path: [0],
                            type: 'text-delta',
                            textDelta: titleToStream,
                        });
                        // Finish the part
                        controller.enqueue({
                            path: [0],
                            type: 'part-finish',
                        });
                    }
                    controller.close();
                },
            });
        },
    };
}

