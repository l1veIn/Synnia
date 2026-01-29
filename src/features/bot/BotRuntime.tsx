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
import { DEFAULT_SYSTEM_PROMPT, type BotMessage, type BotMessageRole } from './types';
import { getAllBotToolDefinitions, executeBotTool } from './BotToolkit';
import { botHistoryAdapter, type BotSessionMeta } from './persistence';
import { modelRegistry } from '@/features/models';
import { loadSettings, getProviderCredentials, ProviderKey } from '@/lib/settings';
import type { ChatMessage } from '@/features/models/types';

// ============================================
// Context Types
// ============================================

interface BotRuntimeContextValue {
    messages: BotMessage[];
    sendMessage: (content: string) => Promise<void>;
    isLoading: boolean;
    clearHistory: () => Promise<void>;
    sessionId: string | null;
    createNewSession: () => Promise<void>;
    loadSession: (sessionId: string) => Promise<void>;
    listSessions: () => Promise<BotSessionMeta[]>;
    deleteSession: (sessionId: string) => Promise<void>;
    selectedModelId: string | null;
    setSelectedModelId: (modelId: string) => void;
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
    const [selectedModelId, setSelectedModelId] = useState<string | null>(() => {
        return localStorage.getItem('bot_selected_model_id') || null;
    });
    const isMountedRef = useRef(true);

    // Initialize: load history on mount
    useEffect(() => {
        // Reset mounted flag on each mount
        isMountedRef.current = true;

        const syncState = () => {
            if (!isMountedRef.current) return;

            const loadedMessages = botHistoryAdapter.getCurrentMessages();
            const currentSessionId = botHistoryAdapter.getCurrentSessionId();

            setMessages(loadedMessages);
            setSessionId(currentSessionId);

            console.log('[BotRuntime] Synced state - session:', currentSessionId, 'messages:', loadedMessages.length);
        };

        if (!isInitializing) {
            isInitializing = true;

            botHistoryAdapter.init()
                .then(() => {
                    syncState();
                })
                .catch((error) => {
                    console.error('[BotRuntime] Failed to initialize persistence:', error);
                    // Still try to sync in case adapter has cached state
                    syncState();
                })
                .finally(() => {
                    isInitializing = false;
                });
        } else {
            // If already initializing (from another mount), just sync current adapter state
            syncState();
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
            // Get model and validate chat capability
            if (!selectedModelId) {
                throw new Error('Please select a model');
            }

            const model = modelRegistry.get(selectedModelId);
            if (!model) {
                throw new Error(`Model not found: ${selectedModelId}`);
            }

            if (!model.chat) {
                throw new Error(`Model "${model.name}" does not support chat`);
            }

            // Get credentials for the model's provider
            const settings = await loadSettings();
            const credentials = getProviderCredentials(settings, model.provider as ProviderKey);

            if (!credentials || !credentials.apiKey) {
                throw new Error(`API key not configured for ${model.provider}`);
            }

            // Convert BotMessage[] to ChatMessage[]
            const chatMessages: ChatMessage[] = updatedMessages.map(msg => ({
                role: msg.role as 'user' | 'assistant' | 'system',
                content: msg.content,
            }));

            // Get tool definitions
            const tools = getAllBotToolDefinitions();

            // Call model.chat() directly
            const result = await model.chat({
                messages: chatMessages,
                systemPrompt: DEFAULT_SYSTEM_PROMPT,
                tools,
                credentials,
            });

            if (!result.success) {
                throw new Error(result.error || 'Chat failed');
            }

            // Process tool calls if present
            let processedToolCalls: BotMessage['toolCalls'] = [];
            if (result.toolCalls && result.toolCalls.length > 0) {
                processedToolCalls = await Promise.all(
                    result.toolCalls.map(async (tc) => {
                        try {
                            const toolResult = await executeBotTool(tc.name, tc.arguments);
                            return {
                                id: tc.id,
                                name: tc.name,
                                arguments: tc.arguments,
                                result: toolResult,
                            };
                        } catch (error) {
                            return {
                                id: tc.id,
                                name: tc.name,
                                arguments: tc.arguments,
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
                id: `msg_${Date.now()}_assistant`,
                role: 'assistant',
                content: result.message?.content || '',
                timestamp: Date.now(),
                toolCalls: processedToolCalls.length > 0 ? processedToolCalls : undefined,
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
    }, [messages, selectedModelId]);

    const clearHistory = useCallback(async () => {
        await botHistoryAdapter.clearCurrentSession();
        setMessages([]);
        setSessionId(botHistoryAdapter.getCurrentSessionId());
    }, []);

    const createNewSession = useCallback(async () => {
        await botHistoryAdapter.clearCurrentSession();
        setMessages([]);
        setSessionId(botHistoryAdapter.getCurrentSessionId());
    }, []);

    const loadSession = useCallback(async (sid: string) => {
        const session = await botHistoryAdapter.loadSession(sid);
        if (session) {
            setMessages(session.messages);
            setSessionId(session.id);
        }
    }, []);

    const listSessions = useCallback(async () => {
        return await botHistoryAdapter.listSessions();
    }, []);

    const deleteSession = useCallback(async (sid: string) => {
        await botHistoryAdapter.deleteSession(sid);
        // If current session was deleted, create a new one
        if (sid === sessionId) {
            await createNewSession();
        }
    }, [sessionId, createNewSession]);

    const value: BotRuntimeContextValue = {
        messages,
        sendMessage,
        isLoading,
        clearHistory,
        sessionId,
        createNewSession,
        loadSession,
        listSessions,
        deleteSession,
        selectedModelId,
        setSelectedModelId: (id: string) => {
            setSelectedModelId(id);
            localStorage.setItem('bot_selected_model_id', id);
        },
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
