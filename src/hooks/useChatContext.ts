/**
 * useChatContext - Hook for managing chat messages (Operational Layer)
 *
 * Chat messages are stored in SQLite chat_messages table, separate from Asset.
 * TEP #001: Asset Ontology - process data separated from business data.
 */

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useWorkflowStore } from '@/store/workflowStore';

// Types matching Rust definitions
export interface ChatMessage {
    id: string;
    nodeId: string;
    role: 'system' | 'user' | 'assistant';
    content: string;
    contentType: 'text' | 'json';  // Display hint for rendering
    timestamp: number;
    attachmentsJson?: string;
    outputAssetId?: string;
}

export function useChatContext(nodeId?: string) {
    const projectRoot = useWorkflowStore((s) => s.projectRoot);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);

    // Fetch messages
    const fetchMessages = useCallback(async () => {
        if (!projectRoot || !nodeId) {
            setMessages([]);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const data = await invoke<ChatMessage[]>('get_chat_messages', {
                projectPath: projectRoot,
                nodeId,
            });
            setMessages(data);
        } catch (e) {
            setError(String(e));
        } finally {
            setIsLoading(false);
        }
    }, [projectRoot, nodeId]);

    // Initial fetch
    useEffect(() => {
        fetchMessages();
    }, [fetchMessages]);

    // Add a message
    const addMessage = useCallback(
        async (
            role: ChatMessage['role'],
            content: string,
            contentType: ChatMessage['contentType'] = 'text',
            attachmentsJson?: string
        ) => {
            if (!projectRoot || !nodeId) throw new Error('No project or node');

            setIsAdding(true);
            try {
                const message: ChatMessage = {
                    id: crypto.randomUUID(),
                    nodeId,
                    role,
                    content,
                    contentType,
                    timestamp: Date.now(),
                    attachmentsJson,
                };

                await invoke('add_chat_message', {
                    projectPath: projectRoot,
                    message,
                });

                // Optimistic update
                setMessages((prev) => [...prev, message]);
                return message;
            } finally {
                setIsAdding(false);
            }
        },
        [projectRoot, nodeId]
    );

    // Clear messages
    const clearMessages = useCallback(async () => {
        if (!projectRoot || !nodeId) return;

        try {
            await invoke('clear_chat_messages', {
                projectPath: projectRoot,
                nodeId,
            });
            setMessages([]);
        } catch (e) {
            setError(String(e));
        }
    }, [projectRoot, nodeId]);

    return {
        messages,
        isLoading,
        error,
        addMessage,
        clearMessages,
        isAdding,
        refresh: fetchMessages,
    };
}
