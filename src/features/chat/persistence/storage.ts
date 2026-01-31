/**
 * Chat persistence storage layer.
 * Wraps Tauri invoke calls for chat CRUD operations.
 */

import { invoke } from '@tauri-apps/api/core';
import type { ChatIndex, ThreadData } from './types';

/** Get the chat index for the current project */
export async function readIndex(): Promise<ChatIndex> {
    return await invoke('chat_get_index');
}

/** Save the chat index */
export async function writeIndex(index: ChatIndex): Promise<void> {
    await invoke('chat_save_index', { index });
}

/** Get a single thread by ID */
export async function readThread(threadId: string): Promise<ThreadData | null> {
    return await invoke('chat_get_thread', { threadId });
}

/** Save a thread */
export async function writeThread(thread: ThreadData): Promise<void> {
    await invoke('chat_save_thread', { thread });
}

/** Delete a thread by ID */
export async function deleteThread(threadId: string): Promise<void> {
    await invoke('chat_delete_thread', { threadId });
}

/** Get a tool confirmation from a thread */
export async function getToolConfirmation(
    threadId: string,
    confirmationId: string
): Promise<import('./types').ToolConfirmation | null> {
    const thread = await readThread(threadId);
    if (!thread) return null;
    return thread.toolConfirmations?.[confirmationId] ?? null;
}

/** Save a tool confirmation to a thread */
export async function saveToolConfirmation(
    threadId: string,
    confirmationId: string,
    confirmation: import('./types').ToolConfirmation
): Promise<void> {
    const thread = await readThread(threadId);
    if (!thread) {
        console.warn(`[storage] Cannot save confirmation - thread ${threadId} not found`);
        return;
    }

    thread.toolConfirmations = thread.toolConfirmations || {};
    thread.toolConfirmations[confirmationId] = confirmation;
    thread.updatedAt = new Date().toISOString();
    await writeThread(thread);
}
