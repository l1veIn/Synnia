/**
 * Bot Runtime - AI Assistant Runtime Provider
 *
 * Provides the runtime context for the AI Bot feature using assistant-ui.
 * For Phase 4, this is a simplified implementation that will be extended
 * in later phases with full tool calling and persistence.
 *
 * Phase 4 Scope:
 * - Basic chat interface with Thread component
 * - Simple echo response from backend
 * - No tools yet (Phase 5)
 * - No persistence yet (Phase 6)
 */

import { ReactNode, createContext, useContext, useCallback, useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import { DEFAULT_SYSTEM_PROMPT, type BotMessage, type BotMessageRole } from './types';

// ============================================
// Context Types
// ============================================

interface BotRuntimeContextValue {
    messages: BotMessage[];
    sendMessage: (content: string) => Promise<void>;
    isLoading: boolean;
}

const BotRuntimeContext = createContext<BotRuntimeContextValue | null>(null);

// ============================================
// Provider Component
// ============================================

interface BotRuntimeProviderProps {
    children: ReactNode;
}

export function BotRuntimeProvider({ children }: BotRuntimeProviderProps) {
    const [messages, setMessages] = useState<BotMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const sendMessage = useCallback(async (content: string) => {
        // Add user message
        const userMessage: BotMessage = {
            id: `msg_${Date.now()}_user`,
            role: 'user',
            content,
            timestamp: Date.now(),
        };

        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);

        try {
            // Call the backend bot_chat command
            const response = await apiClient.botChat({
                messages: [...messages, userMessage],
                systemPrompt: DEFAULT_SYSTEM_PROMPT,
                tools: [], // Tools will be added in Phase 5
                modelId: undefined,
            });

            // Add assistant message
            const assistantMessage: BotMessage = {
                id: response.message.id,
                role: response.message.role as BotMessageRole,
                content: response.message.content,
                timestamp: response.message.timestamp,
                toolCalls: response.toolCalls as BotMessage['toolCalls'],
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('[BotRuntime] Failed to send message:', error);

            // Add error message
            const errorMessage: BotMessage = {
                id: `msg_${Date.now()}_error`,
                role: 'assistant',
                content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                timestamp: Date.now(),
            };

            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    }, [messages]);

    const value: BotRuntimeContextValue = {
        messages,
        sendMessage,
        isLoading,
    };

    return (
        <BotRuntimeContext.Provider value={value}>
            {children}
        </BotRuntimeContext.Provider>
    );
}

// ============================================
// Hook to use the runtime
// ============================================

export function useBotRuntime(): BotRuntimeContextValue {
    const context = useContext(BotRuntimeContext);
    if (!context) {
        throw new Error('useBotRuntime must be used within BotRuntimeProvider');
    }
    return context;
}
