/**
 * Hook to restore the last active thread on mount.
 * 
 * On mount, reads the lastActiveThreadId from the chat index and switches to it.
 * Also saves the current thread ID when it changes.
 */

import { useEffect, useRef } from 'react';
import { useAssistantApi, useAssistantState } from '@assistant-ui/react';
import { readIndex, writeIndex } from './storage';

export function useLastActiveThread() {
    const api = useAssistantApi();
    const { mainThreadId } = useAssistantState((s) => s.threads);
    const hasRestoredRef = useRef(false);
    const lastSavedIdRef = useRef<string | null>(null);

    // Restore last active thread on mount
    useEffect(() => {
        if (hasRestoredRef.current) return;
        hasRestoredRef.current = true;

        const restoreLastActive = async () => {
            try {
                const index = await readIndex();

                // If there's a last active thread and it still exists, switch to it
                if (index.lastActiveThreadId) {
                    const threadExists = index.threads.some(t => t.id === index.lastActiveThreadId);
                    if (threadExists) {
                        console.log('[useLastActiveThread] Restoring last active:', index.lastActiveThreadId);
                        api.threads().switchToThread(index.lastActiveThreadId);
                        lastSavedIdRef.current = index.lastActiveThreadId;
                    }
                }
            } catch (error) {
                console.error('[useLastActiveThread] Error restoring:', error);
            }
        };

        // Small delay to allow threads to load
        setTimeout(restoreLastActive, 200);
    }, [api]);

    // Save current thread as last active when it changes
    useEffect(() => {
        if (!mainThreadId || mainThreadId === lastSavedIdRef.current) return;

        const saveLastActive = async () => {
            try {
                const index = await readIndex();
                // Only save if this thread exists in the list
                const threadExists = index.threads.some(t => t.id === mainThreadId);
                if (threadExists && index.lastActiveThreadId !== mainThreadId) {
                    index.lastActiveThreadId = mainThreadId;
                    await writeIndex(index);
                    lastSavedIdRef.current = mainThreadId;
                    console.log('[useLastActiveThread] Saved last active:', mainThreadId);
                }
            } catch (error) {
                console.error('[useLastActiveThread] Error saving:', error);
            }
        };

        // Debounce saves
        const timeoutId = setTimeout(saveLastActive, 500);
        return () => clearTimeout(timeoutId);
    }, [mainThreadId]);
}
