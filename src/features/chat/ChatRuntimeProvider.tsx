"use client";

import { ReactNode, useMemo, useEffect } from 'react';
import {
    AssistantRuntimeProvider,
    useLocalRuntime,
    unstable_useRemoteThreadListRuntime as useRemoteThreadListRuntime,
    useAuiState,
} from '@assistant-ui/react';
import { useChatModelAdapter } from './useChatModelAdapter';
import { createChatThreadListAdapter, useCurrentThread } from './persistence';
import { createThreadBoundHistoryAdapter } from './persistence/ThreadHistoryAdapter';
import { ChatToolsProvider } from './tools';

interface ChatRuntimeProviderProps {
    children: ReactNode;
}

/**
 * Inner hook that creates the local runtime with a per-thread history adapter.
 * This is called per-thread by useRemoteThreadListRuntime.
 * IMPORTANT: Each thread must have its own history adapter instance to avoid
 * cross-thread message persistence issues.
 */
function useLocalRuntimeWithHistory() {
    const chatAdapter = useChatModelAdapter();

    // Get this thread's remote ID from the current context
    // This is scoped to this particular thread's provider context
    const remoteId = useAuiState(s => s.threadListItem?.remoteId);

    // Create a history adapter bound to THIS specific thread
    // useMemo ensures we only create a new adapter when remoteId changes
    const historyAdapter = useMemo(() => {
        return createThreadBoundHistoryAdapter(remoteId);
    }, [remoteId]);

    // Log for debugging
    useEffect(() => {
        console.log(`[useLocalRuntimeWithHistory] Created runtime for thread: ${remoteId}`);
    }, [remoteId]);

    // Create runtime with the thread-bound history adapter
    const runtime = useLocalRuntime(chatAdapter, {
        adapters: {
            history: historyAdapter,
        },
    });

    return runtime;
}

/**
 * Inner component that uses the current thread tracking hook.
 * Must be inside AssistantRuntimeProvider to access useAui context.
 */
function CurrentThreadTracker({ children }: { children: ReactNode }) {
    useCurrentThread();
    return <>{children}</>;
}

/**
 * ChatRuntimeProvider - Phase 2 (with persistence)
 * Uses useRemoteThreadListRuntime for multi-thread management with JSON file persistence.
 */
export function ChatRuntimeProvider({ children }: ChatRuntimeProviderProps) {
    const threadListAdapter = useMemo(() => createChatThreadListAdapter(), []);

    const runtime = useRemoteThreadListRuntime({
        // Each call to runtimeHook creates an independent runtime for that thread
        runtimeHook: useLocalRuntimeWithHistory,
        adapter: threadListAdapter,
    });

    return (
        <AssistantRuntimeProvider runtime={runtime}>
            <ChatToolsProvider>
                <CurrentThreadTracker>
                    {children}
                </CurrentThreadTracker>
            </ChatToolsProvider>
        </AssistantRuntimeProvider>
    );
}

