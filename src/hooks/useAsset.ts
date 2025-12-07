import { useWorkflowStore } from '@/store/workflowStore';
import { useCallback } from 'react';
import { Asset } from '@/types/assets';

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
    
    const updateAssetContent = useWorkflowStore(state => state.updateAsset);
    const updateAssetMeta = useWorkflowStore(state => state.updateAssetMetadata);
    
    const setContent = useCallback((content: any) => {
        if (assetId) {
            updateAssetContent(assetId, content);
        }
    }, [assetId, updateAssetContent]);

    const setMetadata = useCallback((meta: any) => {
        if (assetId) {
            updateAssetMeta(assetId, meta);
        }
    }, [assetId, updateAssetMeta]);

    return {
        asset,
        setContent,
        setMetadata,
        isLoading: false, // Placeholder for future async/lazy loading logic
        exists: !!asset
    };
}
