import { useState, useCallback } from 'react';
import { toast } from 'sonner';

export type SyncStatus = 'saved' | 'saving' | 'error';

export function useCanvasSync() {
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('saved');

    const wrapSync = useCallback(async (promise: Promise<any>) => {
        setSyncStatus('saving');
        try {
            await promise;
        } catch (e) {
            console.error(e);
            setSyncStatus('error');
            toast.error("Sync failed");
            throw e; // Re-throw so caller knows it failed
        } finally {
            // Small delay to let user see the "Saving..." state
            setTimeout(() => setSyncStatus('saved'), 600);
        }
    }, []);

    return { syncStatus, setSyncStatus, wrapSync };
}
