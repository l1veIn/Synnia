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

/** Tool confirmation result (for human-in-the-loop tools) */
export interface ToolConfirmation {
    state: 'confirmed' | 'cancelled';
    deletedCount?: number;
    timestamp: string;
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
    /** Tool confirmation results, keyed by confirmation ID */
    toolConfirmations?: Record<string, ToolConfirmation>;
}

