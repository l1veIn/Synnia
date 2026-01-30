"use client";

import { ReactNode } from 'react';
import { AssistantRuntimeProvider, useLocalRuntime } from '@assistant-ui/react';
import { useChatModelAdapter } from './useChatModelAdapter';

interface ChatRuntimeProviderProps {
    children: ReactNode;
}

/**
 * ChatRuntimeProvider - Phase 1 (no persistence)
 * Uses useLocalRuntime with ChatModelAdapter for real AI chat.
 */
export function ChatRuntimeProvider({ children }: ChatRuntimeProviderProps) {
    const adapter = useChatModelAdapter();
    const runtime = useLocalRuntime(adapter);

    return (
        <AssistantRuntimeProvider runtime={runtime}>
            {children}
        </AssistantRuntimeProvider>
    );
}
