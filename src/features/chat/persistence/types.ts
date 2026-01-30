/**
 * Chat persistence types.
 * Matches the Rust types in src-tauri/src/features/chat/types.rs
 */

/** Index of all chat threads */
export interface ChatIndex {
    version: number;
    threads: ThreadMetadata[];
    /** ID of the last active (selected) thread */
    lastActiveThreadId?: string;
}

/** Metadata for a single thread (stored in index.json) */
export interface ThreadMetadata {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    isArchived: boolean;
    messageCount: number;
    lastMessage?: string;
    modelId?: string;
}

/** Full thread data (stored in threads/{id}.json) */
export interface ThreadData {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    modelId?: string;
    /** Messages in assistant-ui format */
    messages: unknown[];
}
