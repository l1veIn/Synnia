/**
 * Bot Persistence Module
 *
 * Exports the bot history persistence adapter.
 */

export { botHistoryAdapter } from './adapter';
export type {
    BotHistorySession,
    BotSessionMeta,
} from './adapter';
export {
    generateSessionId,
    initBotPersistence,
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
} from './adapter';
