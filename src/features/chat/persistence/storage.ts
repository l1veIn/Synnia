/**
 * Chat persistence storage layer.
 * Wraps Tauri invoke calls to the Rust backend.
 */

import { invoke } from '@tauri-apps/api/core';
import type { ChatIndex, ThreadData } from './types';

/** Read the chat index (list of all threads) */
export async function readIndex(): Promise<ChatIndex> {
    return await invoke('chat_get_index');
}

/** Write the chat index */
export async function writeIndex(index: ChatIndex): Promise<void> {
    await invoke('chat_save_index', { index });
}

/** Read a single thread by ID */
export async function readThread(threadId: string): Promise<ThreadData | null> {
    return await invoke('chat_get_thread', { threadId });
}

/** Write a thread */
export async function writeThread(thread: ThreadData): Promise<void> {
    await invoke('chat_save_thread', { thread });
}

/** Delete a thread */
export async function deleteThread(threadId: string): Promise<void> {
    await invoke('chat_delete_thread', { threadId });
}
