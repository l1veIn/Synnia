/**
 * Chat persistence types.
 * Matches the Rust types in src-tauri/src/features/chat/types.rs
 */

/** Chat index containing metadata for all threads */
export interface ChatIndex {
    version: number;
    threads: ThreadMetadata[];
}

/** Metadata for a single chat thread (stored in index.json) */
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

/** Full thread data including messages (stored in {threadId}.json) */
export interface ThreadData {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    modelId?: string;
    /** Messages in assistant-ui format */
    messages: unknown[];
}
