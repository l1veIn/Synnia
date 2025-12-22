import { useWorkflowStore } from '@/store/workflowStore';
import { useCallback } from 'react';
import { graphEngine } from '@/lib/engine/GraphEngine';
import { AssetSysMetadata } from '@/types/assets';

/**
 * Hook to bind a component to a specific Asset.
 * Provides reactive access to asset data and methods to update it.
 * 
 * New Asset API:
 * - setValue: Update asset.value
 * - updateConfig: Update asset.config
 * - updateSys: Update asset.sys (name, source)
 */
export function useAsset(assetId?: string) {
    // Select only the specific asset to avoid re-renders on unrelated changes
    const asset = useWorkflowStore(useCallback(
        (state) => (assetId ? state.assets[assetId] : undefined),
        [assetId]
    ));

    // New API: setValue for asset.value
    const setValue = useCallback((value: any) => {
        if (assetId) {
            graphEngine.assets.update(assetId, value);
        }
    }, [assetId]);

    // Update config (schema, options, columns, etc.)
    const updateConfig = useCallback((config: any) => {
        if (assetId) {
            graphEngine.assets.updateConfig(assetId, config);
        }
    }, [assetId]);

    // Update system metadata (name, source)
    const updateSys = useCallback((sysUpdates: Partial<AssetSysMetadata>) => {
        if (assetId) {
            graphEngine.assets.updateSys(assetId, sysUpdates);
        }
    }, [assetId]);

    // Legacy aliases for backward compatibility
    const setContent = setValue;
    const setMetadata = updateSys;

    return {
        asset,
        // New API
        setValue,
        updateConfig,
        updateSys,
        // Legacy aliases
        setContent,
        setMetadata,
        // Status
        isLoading: false,
        exists: !!asset
    };
}
