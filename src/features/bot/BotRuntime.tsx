/**
 * Bot Runtime - AI Assistant Runtime Provider
 *
 * Provides the runtime context for the AI Bot feature using assistant-ui.
 *
 * Phase 5 Scope:
 * - Basic chat interface with Thread component
 * - Tool calling support with 6 core tools
 * - Integration with BotToolkit
 *
 * Phase 6 Scope:
 * - Chat history persistence
 * - Auto-save on message changes
 * - Load history on mount
 */

import { ReactNode, createContext, useContext, useCallback, useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/apiClient';
import { DEFAULT_SYSTEM_PROMPT, type BotMessage, type BotMessageRole } from './types';
import { getAllBotToolDefinitions, executeBotTool } from './BotToolkit';
import { botHistoryAdapter } from './persistence';

// ============================================
// Context Types
// ============================================

interface BotRuntimeContextValue {
    messages: BotMessage[];
    sendMessage: (content: string) => Promise<void>;
    isLoading: boolean;
    clearHistory: () => Promise<void>;
    sessionId: string | null;
}

const BotRuntimeContext = createContext<BotRuntimeContextValue | null>(null);

// ============================================
// Provider Component
// ============================================

interface BotRuntimeProviderProps {
    children: ReactNode;
}

// Track if we're in the middle of loading/saving to prevent loops
let isInitializing = false;

export function BotRuntimeProvider({ children }: BotRuntimeProviderProps) {
    const [messages, setMessages] = useState<BotMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const isMountedRef = useRef(true);

    // Initialize: load history on mount
    useEffect(() => {
        if (isMountedRef.current && !isInitializing) {
            isInitializing = true;

            botHistoryAdapter.init()
                .then(() => {
                    if (!isMountedRef.current) return;

                    const loadedMessages = botHistoryAdapter.getCurrentMessages();
                    const currentSessionId = botHistoryAdapter.getCurrentSessionId();

                    setMessages(loadedMessages);
                    setSessionId(currentSessionId);

                    console.log('[BotRuntime] Initialized with session:', currentSessionId, 'messages:', loadedMessages.length);
                })
                .catch((error) => {
                    console.error('[BotRuntime] Failed to initialize persistence:', error);
                })
                .finally(() => {
                    isInitializing = false;
                });
        }

        // Cleanup on unmount
        return () => {
            isMountedRef.current = false;
            botHistoryAdapter.cleanup();
            // Force save on unmount
            botHistoryAdapter.forceSave().catch(console.error);
        };
    }, []);

    const sendMessage = useCallback(async (content: string) => {
        // Add user message
        const userMessage: BotMessage = {
            id: `msg_${Date.now()}_user`,
            role: 'user',
            content,
            timestamp: Date.now(),
        };

        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        botHistoryAdapter.addMessage(userMessage);
        setIsLoading(true);

        try {
            // Get tool definitions for this request
            const tools = getAllBotToolDefinitions();

            // Call the backend bot_chat command
            const response = await apiClient.botChat({
                messages: updatedMessages,
                systemPrompt: DEFAULT_SYSTEM_PROMPT,
                tools,
                modelId: undefined,
            });

            // Process tool calls if present
            let processedToolCalls: BotMessage['toolCalls'] = [];
            if (response.toolCalls && response.toolCalls.length > 0) {
                processedToolCalls = await Promise.all(
                    response.toolCalls.map(async (toolCall: unknown) => {
                        const tc = toolCall as { name: string; arguments: Record<string, unknown>; id: string };
                        try {
                            const result = await executeBotTool(tc.name, tc.arguments);
                            return {
                                ...tc,
                                result,
                            };
                        } catch (error) {
                            return {
                                ...tc,
                                result: {
                                    error: error instanceof Error ? error.message : String(error),
                                },
                            };
                        }
                    })
                );
            }

            // Add assistant message
            const assistantMessage: BotMessage = {
                id: response.message.id,
                role: response.message.role as BotMessageRole,
                content: response.message.content,
                timestamp: response.message.timestamp,
                toolCalls: processedToolCalls,
            };

            setMessages(prev => [...prev, assistantMessage]);
            botHistoryAdapter.addMessage(assistantMessage);
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
            botHistoryAdapter.addMessage(errorMessage);
        } finally {
            setIsLoading(false);
        }
    }, [messages]);

    const clearHistory = useCallback(async () => {
        await botHistoryAdapter.clearCurrentSession();
        setMessages([]);
        setSessionId(botHistoryAdapter.getCurrentSessionId());
    }, []);

    const value: BotRuntimeContextValue = {
        messages,
        sendMessage,
        isLoading,
        clearHistory,
        sessionId,
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
