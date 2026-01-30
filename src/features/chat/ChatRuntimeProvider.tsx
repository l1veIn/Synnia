"use client";

import { ReactNode, useMemo } from 'react';
import {
    AssistantRuntimeProvider,
    useLocalRuntime,
    unstable_useRemoteThreadListRuntime as useRemoteThreadListRuntime,
    useThreadListItemRuntime,
} from '@assistant-ui/react';
import { useChatModelAdapter } from './useChatModelAdapter';
import { createChatThreadListAdapter, createThreadHistoryAdapter, useLastActiveThread } from './persistence';

interface ChatRuntimeProviderProps {
    children: ReactNode;
}

/**
 * ChatRuntimeProvider with persistent thread list.
 * Uses RemoteThreadListRuntime to sync with local JSON storage.
 */
export function ChatRuntimeProvider({ children }: ChatRuntimeProviderProps) {
    // Create the thread list adapter (memoized)
    const threadListAdapter = useMemo(() => createChatThreadListAdapter(), []);

    // Create runtime with thread list support
    // runtimeHook receives threadId as parameter
    const runtime = useRemoteThreadListRuntime({
        runtimeHook: useModelRuntimeWithHistory,
        adapter: threadListAdapter,
    });

    return (
        <AssistantRuntimeProvider runtime={runtime}>
            <LastActiveThreadRestorer>
                {children}
            </LastActiveThreadRestorer>
        </AssistantRuntimeProvider>
    );
}

/**
 * Component that restores the last active thread on mount.
 * Must be inside AssistantRuntimeProvider to access the API.
 */
function LastActiveThreadRestorer({ children }: { children: ReactNode }) {
    useLastActiveThread();
    return <>{children}</>;
}

/**
 * Hook that provides a per-thread runtime with history adapter.
 * Called by useRemoteThreadListRuntime for each thread.
 */
function useModelRuntimeWithHistory() {
    const adapter = useChatModelAdapter();

    // Get the current thread's remoteId
    const threadListItemRuntime = useThreadListItemRuntime();
    const remoteId = threadListItemRuntime.getState().remoteId;

    // Create history adapter for this thread
    const historyAdapter = useMemo(
        () => createThreadHistoryAdapter(remoteId),
        [remoteId]
    );

    console.log('[useModelRuntimeWithHistory] Creating runtime for thread:', remoteId);

    return useLocalRuntime(adapter, {
        adapters: {
            history: historyAdapter,
        },
    });
}
