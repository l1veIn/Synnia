/**
 * ChatProvider - Runtime integration for agent module.
 *
 * This provider sets up the assistant-ui runtime with:
 * - Backend chat adapter for AI model execution
 * - Thread list adapter for multi-thread management
 * - Per-thread history adapter for message persistence
 *
 *
 */

import { ReactNode, useMemo, useEffect } from 'react';
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  unstable_useRemoteThreadListRuntime as useRemoteThreadListRuntime,
  useAuiState,
} from '@assistant-ui/react';
import { modelRegistry } from '@/features/models';
import { createBackendAdapter } from './BackendAdapter';
import { createThreadBoundHistoryAdapter } from './PersistenceAdapter';
import { useCurrentThread } from './useCurrentThread';

interface ChatProviderProps {
  children: ReactNode;
}

/**
 * Inner hook that creates the local runtime with a per-thread history adapter.
 *
 * This is called per-thread by useRemoteThreadListRuntime.
 * Each thread must have its own history adapter instance to avoid
 * cross-thread message persistence issues.
 */
function useLocalRuntimeWithHistory() {
  // Get this thread's remote ID from the current context
  const remoteId = useAuiState(s => s.threadListItem?.remoteId);

  // Default to gemini-2.5-flash if no model is selected
  const selectedModelId = 'gemini-2.5-flash';

  // Get model from registry
  const model = useMemo(() => {
    return modelRegistry.get(selectedModelId);
  }, [selectedModelId]);

  // Determine provider from model
  const provider = useMemo(() => {
    if (!model) return 'google'; // Default fallback
    return model.provider || model.supportedProviders?.[0] || 'google';
  }, [model]);

  // Create a history adapter bound to THIS specific thread
  const historyAdapter = useMemo(() => {
    return createThreadBoundHistoryAdapter(remoteId);
  }, [remoteId]);

  // Create backend chat adapter
  const chatAdapter = useMemo(() => {
    console.log(`[ChatProvider] Creating adapter for model: ${selectedModelId}, provider: ${provider}`);
    return createBackendAdapter({
      modelId: selectedModelId,
      provider,
      threadId: remoteId,
    });
  }, [selectedModelId, provider, remoteId]);

  // Log for debugging
  useEffect(() => {
    console.log(`[useLocalRuntimeWithHistory] Created runtime for thread: ${remoteId}, model: ${selectedModelId}`);
  }, [remoteId, selectedModelId]);

  // Create runtime with the thread-bound history adapter
  const runtime = useLocalRuntime(chatAdapter, {
    adapters: {
      history: historyAdapter,
    },
  });

  return runtime;
}

/**
 * Inner component that tracks the current thread.
 *
 * Must be inside AssistantRuntimeProvider to access useAui context.
 * Uses useCurrentThread to save/restore the last active thread.
 */
function CurrentThreadTracker({ children }: { children: ReactNode }) {
  // This hook handles saving current thread to localStorage
  // and restoring the last active thread on mount
  useCurrentThread();

  const remoteId = useAuiState(s => s.threadListItem?.remoteId);
  useEffect(() => {
    console.log(`[ChatProvider] Current thread: ${remoteId}`);
  }, [remoteId]);
  return <>{children}</>;
}

/**
 * Thread list adapter for managing multiple threads.
 *
 * Integrates with the backend persistence layer to load and save thread metadata.
 */
function useThreadListAdapter() {
  return useMemo(() => ({
    /** List all threads */
    async list() {
      const { loadThreadList } = await import('./PersistenceAdapter');
      const threads = await loadThreadList();
      return {
        threads: threads.map(t => ({
          remoteId: t.id,
          status: 'regular' as const,
          title: t.title,
        })),
      };
    },

    /** Create a new thread (called when first message is sent) */
    async initialize(_threadId: string) {
      const { createThread } = await import('./PersistenceAdapter');
      const result = await createThread({ modelId: 'gemini-2.5-flash', provider: 'google' });
      return { remoteId: result.threadId, externalId: undefined };
    },

    /** Rename a thread */
    async rename(remoteId: string, title: string): Promise<void> {
      const { updateThread } = await import('./PersistenceAdapter');
      await updateThread({ threadId: remoteId, title });
    },

    /** Archive a thread */
    async archive(_remoteId: string): Promise<void> {
      // Optional: Implement archive if needed
    },

    /** Unarchive a thread */
    async unarchive(_remoteId: string): Promise<void> {
      // Optional: Implement unarchive if needed
    },

    /** Delete a thread */
    async delete(remoteId: string): Promise<void> {
      const { deleteThread } = await import('./PersistenceAdapter');
      await deleteThread(remoteId);
    },

    /** Fetch thread details */
    async fetch(remoteId: string) {
      const { getThread } = await import('./PersistenceAdapter');
      const thread = await getThread(remoteId);
      return {
        remoteId,
        status: 'regular' as const,
        title: thread?.title || 'Chat',
      };
    },

    /** Generate title from first user message */
    async generateTitle(
      remoteId: string,
      messages: readonly { role: string; content: readonly { type: string; text?: string }[] }[]
    ) {
      // Simple implementation: use first user message (no AI)
      const firstUserMessage = messages.find(m => m.role === 'user');
      let title = 'New Chat';

      if (firstUserMessage) {
        const textContent = firstUserMessage.content
          .filter(c => c.type === 'text' && c.text)
          .map(c => c.text)
          .join('');
        if (textContent.trim()) {
          title = textContent.slice(0, 30) + (textContent.length > 30 ? '...' : '');
        }
      }

      // Update the title in backend
      if (title !== 'New Chat') {
        const { updateThread } = await import('./PersistenceAdapter');
        await updateThread({ threadId: remoteId, title });
      }

      // Return a properly formatted AssistantStream with the title
      // Must include path, part-start, text-delta, and part-finish
      const titleToStream = title !== 'New Chat' ? title : '';

      return new ReadableStream({
        start(controller) {
          if (titleToStream) {
            // Start a text part
            controller.enqueue({
              path: [0],
              type: 'part-start',
              part: { type: 'text' },
            });
            // Send the title as text delta
            controller.enqueue({
              path: [0],
              type: 'text-delta',
              textDelta: titleToStream,
            });
            // Finish the part
            controller.enqueue({
              path: [0],
              type: 'part-finish',
            });
          }
          controller.close();
        },
      });
    },
  }), []);
}

/**
 * ChatProvider - Main runtime provider for agent module.
 *
 * Uses useRemoteThreadListRuntime for multi-thread management with
 * backend persistence.
 */
export function ChatProvider({ children }: ChatProviderProps) {
  const threadListAdapter = useThreadListAdapter();

  const runtime = useRemoteThreadListRuntime({
    // Each call to runtimeHook creates an independent runtime for that thread
    runtimeHook: useLocalRuntimeWithHistory,
    adapter: threadListAdapter,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <CurrentThreadTracker>
        {children}
      </CurrentThreadTracker>
    </AssistantRuntimeProvider>
  );
}
