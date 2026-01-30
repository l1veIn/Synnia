/**
 * Chat persistence module.
 * Provides JSON file-based persistence for chat conversations.
 */

export * from './types';
export * from './storage';
export { createChatThreadListAdapter } from './ChatThreadListAdapter';
export { createThreadHistoryAdapter } from './ThreadHistoryAdapter';
export { useLastActiveThread } from './useLastActiveThread';
