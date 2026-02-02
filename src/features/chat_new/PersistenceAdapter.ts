/**
 * PersistenceAdapter - Backend persistence calls for agent_new module.
 *
 * This module provides functions to call backend Tauri commands for
 * thread and message persistence operations.
 *
 * Reference: src/features/chat/persistence/ThreadHistoryAdapter.ts
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  ThreadHistoryAdapter,
  ExportedMessageRepository,
  ExportedMessageRepositoryItem,
} from '@assistant-ui/react';
import type {
  ThreadInfo,
  MessageInfo,
  CreateThreadRequest,
  CreateThreadResponse,
  UpdateThreadRequest,
  ChatRequest,
  ChatResponse,
} from './types';

// =============================================================================
// Thread Operations
// =============================================================================

/**
 * Get all threads for the current project.
 *
 * Calls the backend `get_threads_command` and returns threads ordered
 * by most recently updated.
 */
export async function getThreads(): Promise<ThreadInfo[]> {
  return await invoke<ThreadInfo[]>('get_threads_command');
}

/**
 * Get a specific thread by ID.
 *
 * Calls the backend `get_thread_command`.
 */
export async function getThread(threadId: string): Promise<ThreadInfo | null> {
  return await invoke<ThreadInfo | null>('get_thread_command', { threadId });
}

/**
 * Create a new thread.
 *
 * Calls the backend `create_thread_command`.
 */
export async function createThread(request: CreateThreadRequest): Promise<CreateThreadResponse> {
  return await invoke<CreateThreadResponse>('create_thread_command', { request });
}

/**
 * Update a thread's title.
 *
 * Calls the backend `update_thread_command`.
 */
export async function updateThread(request: UpdateThreadRequest): Promise<void> {
  await invoke('update_thread_command', { request });
}

/**
 * Delete a thread and all its messages.
 *
 * Calls the backend `delete_thread_command`.
 */
export async function deleteThread(threadId: string): Promise<void> {
  await invoke('delete_thread_command', { threadId });
}

// =============================================================================
// Message Operations
// =============================================================================

/**
 * Get all messages for a thread.
 *
 * Calls the backend `get_messages_command`.
 */
export async function getMessages(threadId: string): Promise<MessageInfo[]> {
  return await invoke<MessageInfo[]>('get_messages_command', { threadId });
}

// =============================================================================
// Chat Operations (Non-streaming)
// =============================================================================

/**
 * Send a chat message and get a response (non-streaming).
 *
 * Calls the backend `chat_send_command`.
 */
export async function sendChat(request: ChatRequest): Promise<ChatResponse> {
  return await invoke<ChatResponse>('chat_send_command', { request });
}

// =============================================================================
// Provider Operations
// =============================================================================

/**
 * Get list of available providers.
 *
 * Returns providers that have API keys configured or are local providers.
 * This is used by the frontend to filter available models.
 */
export async function getAvailableProviders(): Promise<string[]> {
  return await invoke<string[]>('get_available_providers_command');
}

// Note: setProjectPath and getProjectPath removed.
// agent_new now uses AppState.current_project_path managed by project module.

// =============================================================================
// Thread History Adapter for assistant-ui
// =============================================================================

/**
 * Creates a history adapter bound to a specific thread ID.
 *
 * This adapter integrates with assistant-ui's ThreadHistoryAdapter to
 * load and persist messages for a specific thread.
 *
 * @param threadId - The remote thread ID to bind to (may be undefined for new threads)
 */
export function createThreadBoundHistoryAdapter(threadId: string | undefined): ThreadHistoryAdapter {
  const boundThreadId = threadId;

  return {
    /** Load messages for the bound thread */
    async load(): Promise<ExportedMessageRepository> {
      if (!boundThreadId) {
        console.log('[ThreadHistoryAdapter] No thread ID - returning empty (new thread)');
        return { messages: [] };
      }

      const messages = await getMessages(boundThreadId);
      if (!messages || messages.length === 0) {
        return { messages: [] };
      }

      console.log(`[ThreadHistoryAdapter] Loaded ${messages.length} messages for thread ${boundThreadId}`);

      // Convert stored messages to ExportedMessageRepository format
      const exportedMessages: ExportedMessageRepository['messages'] = [];
      let lastId: string | null = null;

      for (const msg of messages) {
        try {
          // Parse the contentJson which already contains the full assistant-ui format
          const parsedMessage = JSON.parse(msg.contentJson);

          // Ensure required fields exist (in case of older data)
          if (!parsedMessage.attachments) {
            parsedMessage.attachments = [];
          }
          if (!parsedMessage.metadata) {
            parsedMessage.metadata = {};
          }
          if (!parsedMessage.metadata.unstable_state) {
            parsedMessage.metadata.unstable_state = {};
          }

          // Convert createdAt string to Date if needed
          if (typeof parsedMessage.createdAt === 'string') {
            parsedMessage.createdAt = new Date(parsedMessage.createdAt);
          }

          exportedMessages.push({
            message: parsedMessage as ExportedMessageRepositoryItem['message'],
            parentId: lastId,
          });
          lastId = parsedMessage.id;
        } catch (e) {
          console.error(`[ThreadHistoryAdapter] Failed to parse message ${msg.id}:`, e);
        }
      }

      return {
        headId: lastId,
        messages: exportedMessages,
      };
    },

    /** Append a message when it completes */
    async append(item: ExportedMessageRepositoryItem): Promise<void> {
      if (!boundThreadId) {
        console.warn('[ThreadHistoryAdapter] Cannot append - no bound thread ID (new thread not yet initialized)');
        return;
      }

      // Note: Backend handles message persistence via WAL (Write Ahead Logging)
      // This is a placeholder for any additional frontend-side persistence
      console.log(`[ThreadHistoryAdapter] Message append requested for thread ${boundThreadId}`);
      console.log(`[ThreadHistoryAdapter] Note: Messages are persisted by backend via WAL`);
    },
  };
}

/**
 * Thread list adapter for managing multiple threads.
 *
 * Provides a simple interface for loading and saving thread metadata.
 */
export interface ThreadListMeta {
  id: string;
  title: string;
  updatedAt: string;
  messageCount?: number;
  lastMessage?: string;
}

/**
 * Load thread list metadata.
 *
 * Converts ThreadInfo[] to ThreadListMeta[] format.
 */
export async function loadThreadList(): Promise<ThreadListMeta[]> {
  const threads = await getThreads();

  return threads.map((thread) => ({
    id: thread.id,
    title: thread.title,
    updatedAt: thread.updatedAt,
  }));
}
