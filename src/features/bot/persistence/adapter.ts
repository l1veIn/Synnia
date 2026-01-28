/**
 * Bot History Persistence Adapter
 *
 * Manages saving and loading bot chat history.
 * Integrates with Tauri backend for file-based persistence.
 *
 * Phase 6: Persistence implementation
 */

import { apiClient } from '@/lib/apiClient';
import type { BotMessage } from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Bot chat history session stored on disk
 */
export interface BotHistorySession {
    id: string;
    created_at: number;
    updated_at: number;
    messages: BotMessage[];
}

/**
 * Bot session metadata (for listing sessions)
 */
export interface BotSessionMeta {
    id: string;
    created_at: number;
    updated_at: number;
    message_count: number;
}

// ============================================================================
// Current Session Manager
// ============================================================================

/**
 * Generates a new session ID based on timestamp
 */
export function generateSessionId(): string {
    return `bot_${Date.now()}`;
}

/**
 * Current session state (in-memory)
 */
let currentSessionId: string | null = null;
let currentMessages: BotMessage[] = [];
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
const AUTO_SAVE_DELAY = 2000; // 2 seconds after last message

// ============================================================================
// Public API
// ============================================================================

/**
 * Convert API response message to BotMessage
 */
function convertApiMessage(message: {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    toolCalls?: unknown[];
    metadata?: Record<string, unknown>;
}): BotMessage {
    return {
        id: message.id,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
        toolCalls: message.toolCalls as BotMessage['toolCalls'],
        metadata: message.metadata,
    };
}

/**
 * Initialize the persistence layer.
 * Loads the most recent session if available.
 */
export async function initBotPersistence(): Promise<void> {
    try {
        const response = await apiClient.loadBotHistory();
        if (response?.session) {
            currentSessionId = response.session.id;
            // Convert API messages to BotMessage format
            currentMessages = response.session.messages.map(convertApiMessage);
            console.log('[BotPersistence] Loaded session:', currentSessionId);
        } else {
            // Start a new session
            currentSessionId = generateSessionId();
            currentMessages = [];
            console.log('[BotPersistence] Started new session:', currentSessionId);
        }
    } catch (error) {
        console.error('[BotPersistence] Failed to initialize:', error);
        // Start fresh on error
        currentSessionId = generateSessionId();
        currentMessages = [];
    }
}

/**
 * Get the current session ID
 */
export function getCurrentSessionId(): string | null {
    return currentSessionId;
}

/**
 * Get the current messages
 */
export function getCurrentMessages(): BotMessage[] {
    return [...currentMessages];
}

/**
 * Set the current session ID (for starting a new session)
 */
export function setCurrentSessionId(sessionId: string): void {
    currentSessionId = sessionId;
    currentMessages = [];
    // Clear any pending auto-save
    if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = null;
    }
}

/**
 * Add a message to the current session and trigger auto-save
 */
export function addMessage(message: BotMessage): void {
    currentMessages.push(message);

    // Clear existing timer
    if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
    }

    // Schedule auto-save
    autoSaveTimer = setTimeout(() => {
        saveCurrentSession().catch(console.error);
    }, AUTO_SAVE_DELAY);
}

/**
 * Update a message in the current session (e.g., after tool execution)
 */
export function updateMessage(messageId: string, updates: Partial<BotMessage>): void {
    const index = currentMessages.findIndex(m => m.id === messageId);
    if (index !== -1) {
        currentMessages[index] = { ...currentMessages[index], ...updates };

        // Trigger auto-save
        if (autoSaveTimer) {
            clearTimeout(autoSaveTimer);
        }
        autoSaveTimer = setTimeout(() => {
            saveCurrentSession().catch(console.error);
        }, AUTO_SAVE_DELAY);
    }
}

/**
 * Set all messages for the current session
 */
export function setMessages(messages: BotMessage[]): void {
    currentMessages = [...messages];

    // Trigger auto-save
    if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
    }
    autoSaveTimer = setTimeout(() => {
        saveCurrentSession().catch(console.error);
    }, AUTO_SAVE_DELAY);
}

/**
 * Clear the current session (start fresh)
 */
export async function clearCurrentSession(): Promise<void> {
    currentSessionId = generateSessionId();
    currentMessages = [];
    if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = null;
    }
    await saveCurrentSession();
}

/**
 * Save the current session to disk
 */
export async function saveCurrentSession(): Promise<void> {
    if (!currentSessionId) {
        console.warn('[BotPersistence] No session ID, skipping save');
        return;
    }

    try {
        await apiClient.saveBotHistory({
            sessionId: currentSessionId,
            messages: currentMessages,
        });
        console.log('[BotPersistence] Saved session:', currentSessionId);
    } catch (error) {
        console.error('[BotPersistence] Failed to save session:', error);
    }
}

/**
 * Force save immediately (don't wait for auto-save timer)
 */
export async function forceSave(): Promise<void> {
    if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = null;
    }
    await saveCurrentSession();
}

/**
 * Load a specific session by ID
 */
export async function loadSession(sessionId: string): Promise<BotHistorySession | null> {
    try {
        const response = await apiClient.loadBotHistory(sessionId);
        if (response?.session) {
            currentSessionId = response.session.id;
            // Convert API messages to BotMessage format
            const convertedMessages = response.session.messages.map(convertApiMessage);
            currentMessages = convertedMessages;
            return {
                id: response.session.id,
                created_at: response.session.createdAt,
                updated_at: response.session.updatedAt,
                messages: convertedMessages,
            };
        }
        return null;
    } catch (error) {
        console.error('[BotPersistence] Failed to load session:', error);
        return null;
    }
}

/**
 * List all available sessions
 */
export async function listSessions(): Promise<BotSessionMeta[]> {
    try {
        const sessions = await apiClient.listBotSessions();
        return sessions.map(s => ({
            id: s.id,
            created_at: s.createdAt,
            updated_at: s.updatedAt,
            message_count: s.messageCount,
        }));
    } catch (error) {
        console.error('[BotPersistence] Failed to list sessions:', error);
        return [];
    }
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId: string): Promise<void> {
    try {
        await apiClient.deleteBotSession(sessionId);
        // If we deleted the current session, start fresh
        if (currentSessionId === sessionId) {
            await clearCurrentSession();
        }
    } catch (error) {
        console.error('[BotPersistence] Failed to delete session:', error);
        throw error;
    }
}

/**
 * Clean up resources (call when unmounting)
 */
export function cleanup(): void {
    if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = null;
    }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const botHistoryAdapter = {
    init: initBotPersistence,
    getCurrentSessionId,
    getCurrentMessages,
    setCurrentSessionId,
    addMessage,
    updateMessage,
    setMessages,
    clearCurrentSession,
    saveCurrentSession,
    forceSave,
    loadSession,
    listSessions,
    deleteSession,
    cleanup,
};
