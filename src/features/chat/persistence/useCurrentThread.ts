/**
 * useCurrentThread - Hook for tracking and persisting the current active thread.
 * Stores the last active thread ID in localStorage per project.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useAuiState, useAui } from '@assistant-ui/react';
import { useWorkflowStore } from '@/store/workflowStore';

const STORAGE_KEY_PREFIX = 'synnia-chat-lastActiveThread';

/**
 * Get the localStorage key for the current project.
 */
function getStorageKey(projectRoot: string | null): string | null {
    if (!projectRoot) return null;
    // Use a hash of the project path to create a unique key
    const pathParts = projectRoot.split('/').filter(Boolean);
    const projectName = pathParts[pathParts.length - 1] || 'default';
    return `${STORAGE_KEY_PREFIX}-${projectName}-${projectRoot.length}`;
}

/**
 * Hook to manage the current thread ID with localStorage persistence.
 * - Saves the current thread ID whenever it changes
 * - Restores the last active thread on mount
 */
export function useCurrentThread(): void {
    const projectRoot = useWorkflowStore(s => s.projectRoot);
    const aui = useAui();
    const initialized = useRef(false);

    // Track the current thread ID from runtime state
    const currentThreadId = useAuiState(s => s.threadListItem?.remoteId);
    const previousThreadIdRef = useRef<string | undefined>(undefined);

    // Save thread ID to localStorage when it changes, or clear if no thread
    useEffect(() => {
        const storageKey = getStorageKey(projectRoot);
        if (!storageKey) return;

        // If there's no current thread (all threads deleted), clear the cache
        if (!currentThreadId) {
            if (previousThreadIdRef.current) {
                console.log('[useCurrentThread] No active thread, clearing cache');
                localStorage.removeItem(storageKey);
                previousThreadIdRef.current = undefined;
            }
            return;
        }

        // Only save if it actually changed
        if (currentThreadId !== previousThreadIdRef.current) {
            console.log('[useCurrentThread] Saving current thread:', currentThreadId);
            localStorage.setItem(storageKey, currentThreadId);
            previousThreadIdRef.current = currentThreadId;
        }
    }, [currentThreadId, projectRoot]);

    // Restore last active thread on initial mount
    const restoreThread = useCallback(() => {
        if (initialized.current) return;

        const storageKey = getStorageKey(projectRoot);
        if (!storageKey) return;

        const lastThreadId = localStorage.getItem(storageKey);
        if (!lastThreadId) {
            initialized.current = true;
            return;
        }

        console.log('[useCurrentThread] Restoring last thread:', lastThreadId);

        try {
            // Switch to the saved thread if it exists
            aui.threads().switchToThread(lastThreadId);
            initialized.current = true;
        } catch (e) {
            console.warn('[useCurrentThread] Failed to restore thread:', e);
            // Thread might have been deleted, clear the cache
            localStorage.removeItem(storageKey);
            initialized.current = true;
        }
    }, [aui, projectRoot]);

    // Try to restore on mount with a small delay to ensure thread list is loaded
    useEffect(() => {
        const timer = setTimeout(restoreThread, 200);
        return () => clearTimeout(timer);
    }, [restoreThread]);
}

/**
 * Clear the current thread cache for a project.
 * Call this when the current thread is deleted.
 */
export function clearCurrentThreadCache(projectRoot: string | null): void {
    const storageKey = getStorageKey(projectRoot);
    if (storageKey) {
        localStorage.removeItem(storageKey);
        console.log('[useCurrentThread] Cache cleared');
    }
}
