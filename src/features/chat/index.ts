/**
 * chat module - Frontend for agent backend module.
 *
 * This module provides a clean, frontend-only interface for the agent
 * backend functionality, including:
 *
 * - Type definitions synchronized with backend
 * - Backend chat adapter for AI model execution
 * - Persistence adapter for thread/message storage
 * - React provider for runtime integration
 * - Tool UI components for rendering tool calls
 *
 *
 *
 * @module chat
 */

// =============================================================================
// Type Definitions
// =============================================================================

export type {
  StreamEvent,
  ThreadInfo,
  MessageInfo,
  CreateThreadRequest,
  CreateThreadResponse,
  ChatRequest,
  ChatResponse,
  UpdateThreadRequest,
} from './types';

export {
  isTokenEvent,
  isToolCallEvent,
  isToolResultEvent,
  isErrorEvent,
  isCompleteEvent,
} from './types';

// =============================================================================
// Backend Adapter
// =============================================================================

export { createBackendAdapter } from './BackendAdapter';
export type { BackendAdapterOptions } from './BackendAdapter';

// =============================================================================
// Persistence Adapter
// =============================================================================

export {
  getThreads,
  getThread,
  createThread,
  updateThread,
  deleteThread,
  getMessages,
  sendChat,
  getAvailableProviders,
  createThreadBoundHistoryAdapter,
  loadThreadList,
} from './PersistenceAdapter';

export type { ThreadListMeta } from './PersistenceAdapter';

// =============================================================================
// React Provider
// =============================================================================

export { ChatProvider } from './ChatProvider';

// =============================================================================
// Tool UI Components
// =============================================================================

export { ToolUIRegistry, GetNodesListToolUI } from './tools/ToolUIRegistry';
export type { NodeInfo } from './tools/ToolUIRegistry';
