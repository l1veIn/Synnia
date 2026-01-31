/**
 * Chat persistence module.
 * Provides thread list and history adapters for assistant-ui integration.
 */

export * from './types';
export * from './storage';
export { createChatThreadListAdapter } from './ChatThreadListAdapter';
export { createThreadBoundHistoryAdapter, createDynamicThreadHistoryAdapter } from './ThreadHistoryAdapter';
export { useCurrentThread } from './useCurrentThread';
