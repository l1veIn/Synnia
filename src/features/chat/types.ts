/**
 * Type definitions for chat module.
 *
 * SYNC: src-tauri/src/features/agent/executor.rs
 *
 * This file contains type definitions that must match the backend
 * StreamEvent and related types in executor.rs.
 */

// =============================================================================
// Stream Events (must match backend StreamEvent enum)
// =============================================================================

/**
 * Stream event types received from the backend during chat execution.
 *
 * These events are emitted via Tauri events with the pattern `agent-stream-{thread_id}`.
 * They correspond to the StreamEvent enum in executor.rs.
 *
 * @see src-tauri/src/features/agent/executor.rs:StreamEvent
 */
export type StreamEvent =
  | { type: 'token'; text: string }
  | { type: 'toolCall'; id: string; name: string; args: string }
  | { type: 'toolResult'; id: string; name: string; result: string }
  | { type: 'error'; message: string }
  | { type: 'complete' };

/**
 * Type guard for token events.
 */
export function isTokenEvent(event: StreamEvent): event is { type: 'token'; text: string } {
  return event.type === 'token';
}

/**
 * Type guard for tool call events.
 */
export function isToolCallEvent(event: StreamEvent): event is { type: 'toolCall'; id: string; name: string; args: string } {
  return event.type === 'toolCall';
}

/**
 * Type guard for tool result events.
 */
export function isToolResultEvent(event: StreamEvent): event is { type: 'toolResult'; id: string; name: string; result: string } {
  return event.type === 'toolResult';
}

/**
 * Type guard for error events.
 */
export function isErrorEvent(event: StreamEvent): event is { type: 'error'; message: string } {
  return event.type === 'error';
}

/**
 * Type guard for complete events.
 */
export function isCompleteEvent(event: StreamEvent): event is { type: 'complete' } {
  return event.type === 'complete';
}

// =============================================================================
// Thread Types (must match backend ThreadInfo)
// =============================================================================

/**
 * Thread information from the backend.
 *
 * Corresponds to ThreadInfo in executor.rs.
 */
export interface ThreadInfo {
  id: string;
  title: string;
  modelId: string;
  provider: string;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Message Types (must match backend MessageInfo)
// =============================================================================

/**
 * Message information from the backend.
 *
 * Corresponds to MessageInfo in storage/repository.rs.
 * The contentJson field contains the full assistant-ui message format.
 */
export interface MessageInfo {
  id: string;
  role: 'user' | 'assistant';
  contentJson: string;  // Full assistant-ui message format as JSON
  modelId?: string;     // Optional: model used for this message
  provider?: string;    // Optional: provider used for this message
  createdAt: string;
}

// =============================================================================
// Chat Request Types
// =============================================================================

/**
 * Request parameters for creating a new thread.
 */
export interface CreateThreadRequest {
  title?: string;
  modelId: string;
  provider: string;
}

/**
 * Response when creating a new thread.
 */
export interface CreateThreadResponse {
  threadId: string;
  title: string;
}

/**
 * Request parameters for sending a chat message.
 */
export interface ChatRequest {
  threadId?: string;
  content: string;
  modelId: string;
  provider: string;
  supportsStreaming?: boolean;
}

/**
 * Response for non-streaming chat completion.
 */
export interface ChatResponse {
  threadId: string;
  messageId: string;
  content: string;
  modelId: string;
  provider: string;
}

/**
 * Request parameters for updating a thread.
 */
export interface UpdateThreadRequest {
  threadId: string;
  title?: string;
}
