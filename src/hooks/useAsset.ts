import { useWorkflowStore } from '@/store/workflowStore';
import { useCallback } from 'react';
import { graphEngine } from '@/lib/engine/GraphEngine';

/**
 * Hook to bind a component to a specific Asset.
 * Provides reactive access to asset data and a method to update it.
 */
export function useAsset(assetId?: string) {
    // Select only the specific asset to avoid re-renders on unrelated changes
    const asset = useWorkflowStore(useCallback(
        (state) => (assetId ? state.assets[assetId] : undefined),
        [assetId]
    ));

    const setContent = useCallback((content: any) => {
        if (assetId) {
            graphEngine.assets.update(assetId, content);
        }
    }, [assetId]);

    const setMetadata = useCallback((meta: any) => {
        if (assetId) {
            graphEngine.assets.updateMetadata(assetId, meta);
        }
    }, [assetId]);

    return {
        asset,
        setContent,
        setMetadata,
        isLoading: false,
        exists: !!asset
    };
}
