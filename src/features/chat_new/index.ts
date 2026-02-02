/**
 * chat_new module - Frontend for agent_new backend module.
 *
 * This module provides a clean, frontend-only interface for the agent_new
 * backend functionality, including:
 *
 * - Type definitions synchronized with backend
 * - Backend chat adapter for AI model execution
 * - Persistence adapter for thread/message storage
 * - React provider for runtime integration
 * - Tool UI components for rendering tool calls
 *
 * Reference implementation: src/features/chat/
 *
 * @module chat_new
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
