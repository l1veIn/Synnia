/**
 * Chat Thread List Adapter for assistant-ui.
 * Implements RemoteThreadListAdapter to persist threads to local JSON files.
 */

"use client";

import { type unstable_RemoteThreadListAdapter as RemoteThreadListAdapter } from '@assistant-ui/react';
import { createAssistantStream } from 'assistant-stream';
import { v4 as uuidv4 } from 'uuid';
import { readIndex, writeIndex, readThread, writeThread, deleteThread } from './storage';
import type { ThreadData } from './types';


/**
 * Create the RemoteThreadListAdapter for chat persistence.
 * Note: ThreadHistoryAdapter is now injected via runtimeHook in ChatRuntimeProvider,
 * NOT through unstable_Provider.
 */
export function createChatThreadListAdapter(): RemoteThreadListAdapter {
    return {
        async list() {
            const index = await readIndex();
            console.log('[ChatThreadListAdapter] list() called, threads:', index.threads.length);
            return {
                threads: index.threads.map((t) => ({
                    remoteId: t.id,
                    status: t.isArchived ? ('archived' as const) : ('regular' as const),
                    title: t.title,
                })),
            };
        },

        async initialize(_localId: string) {
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
            index.threads.unshift({
                id,
                title: 'New Chat',
                createdAt: now,
                updatedAt: now,
                isArchived: false,
                messageCount: 0,
            });
            await writeIndex(index);

            console.log('[ChatThreadListAdapter] initialize() completed, id:', id);
            return { remoteId: id, externalId: undefined };
        },

        async rename(remoteId: string, title: string) {
            const now = new Date().toISOString();

            // Update index
            const index = await readIndex();
            const threadMeta = index.threads.find((t) => t.id === remoteId);
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

        async archive(remoteId: string) {
            const index = await readIndex();
            const threadMeta = index.threads.find((t) => t.id === remoteId);
            if (threadMeta) {
                threadMeta.isArchived = true;
                threadMeta.updatedAt = new Date().toISOString();
                await writeIndex(index);
            }
        },

        async unarchive(remoteId: string) {
            const index = await readIndex();
            const threadMeta = index.threads.find((t) => t.id === remoteId);
            if (threadMeta) {
                threadMeta.isArchived = false;
                threadMeta.updatedAt = new Date().toISOString();
                await writeIndex(index);
            }
        },

        async delete(remoteId: string) {
            // Delete thread file
            await deleteThread(remoteId);

            // Update index
            const index = await readIndex();
            index.threads = index.threads.filter((t) => t.id !== remoteId);
            await writeIndex(index);
        },

        async fetch(remoteId: string) {
            const index = await readIndex();
            const threadMeta = index.threads.find((t) => t.id === remoteId);

            return {
                remoteId,
                status: threadMeta?.isArchived ? ('archived' as const) : ('regular' as const),
                title: threadMeta?.title ?? 'Chat',
            };
        },

        async generateTitle(_remoteId: string, messages: readonly unknown[]) {
            // Extract title from first user message
            const firstUserMessage = messages.find(
                (m) => (m as { role: string }).role === 'user'
            ) as { content: Array<{ type: string; text?: string }> } | undefined;

            let title = 'New Chat';

            if (firstUserMessage?.content) {
                const textContent = firstUserMessage.content
                    .filter((c) => c.type === 'text')
                    .map((c) => c.text ?? '')
                    .join('');
                title = textContent.slice(0, 30) + (textContent.length > 30 ? '...' : '');
            }

            // Return AssistantStream with the title
            return createAssistantStream(async ({ appendText }) => {
                appendText(title);
            });
        },

        // NOTE: unstable_Provider removed - history adapter is now passed via runtimeHook
    };
}
