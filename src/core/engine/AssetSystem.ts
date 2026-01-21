import { GraphEngine } from './GraphEngine';
import { Asset, ValueType, AssetSysMetadata } from '@/types/assets';
import { useWorkflowStore } from '@/store/workflowStore';
import { v4 as uuidv4 } from 'uuid';
import { apiClient } from '@/lib/apiClient';

export class AssetSystem {
    private engine: GraphEngine;

    constructor(engine: GraphEngine) {
        this.engine = engine;
    }

    private get store() {
        return useWorkflowStore.getState();
    }

    /**
     * Set the raw assets object in the store.
     * Use sparingly, prefer granular updates.
     */
    public setAssets(assets: Record<string, Asset>) {
        useWorkflowStore.setState({ assets });
    }

    /**
     * Create a new asset with the new unified structure.
     */
    public create(
        valueType: ValueType,
        value: any,
        options: {
            name?: string;
            config?: any;
            source?: 'user' | 'ai' | 'import';
            sys?: Partial<AssetSysMetadata>;  // Partial sys to merge (e.g., isLibraryAsset)
        } = {}
    ): string {
        const id = uuidv4();
        const now = Date.now();

        // Merge partial sys from options
        const sys: AssetSysMetadata = {
            name: options.name || 'New Asset',
            createdAt: now,
            updatedAt: now,
            source: options.source || 'user',
            isLibraryAsset: null,
            ...options.sys,
        };

        // Build the asset based on valueType
        const newAsset: Asset = {
            id,
            valueType,
            value,
            config: options.config,
            sys,
        } as Asset;

        const { assets } = this.store;
        this.setAssets({ ...assets, [id]: newAsset });

        // Save initial version to backend (creates first history entry)
        this.saveAssetToBackend(newAsset);

        return id;
    }

    /**
     * Update the value of an asset.
     */
    public update(id: string, value: any) {
        const { assets } = this.store;
        const asset = assets[id];
        if (!asset) {
            console.warn(`Attempted to update non-existent asset ${id}`);
            return;
        }

        const updatedAsset: Asset = {
            ...asset,
            value,
            sys: {
                ...asset.sys,
                updatedAt: Date.now()
            }
        } as Asset;

        this.setAssets({
            ...assets,
            [id]: updatedAsset
        });

        // Save to backend (history is auto-created only when value hash changes)
        this.saveAssetToBackend(updatedAsset).catch(err => {
            console.warn('Failed to save asset:', err);
        });
    }

    /**
     * Update config of an asset (e.g., schema, columns, options).
     */
    public updateConfig(id: string, config: any) {
        const { assets } = this.store;
        const asset = assets[id];
        if (!asset) return;

        const updatedAsset: Asset = {
            ...asset,
            config: { ...asset.config, ...config },
            sys: {
                ...asset.sys,
                // updatedAt: Date.now()
            }
        } as Asset;

        this.setAssets({
            ...assets,
            [id]: updatedAsset
        });

        // Persist to backend (no history created since value unchanged)
        this.saveAssetToBackend(updatedAsset).catch(err => {
            console.warn('Failed to persist asset config:', err);
        });
    }

    /**
     * Save asset to backend.
     * History snapshot is auto-created only when value hash changes.
     */
    private async saveAssetToBackend(asset: Asset) {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('save_asset_with_history', { asset });
        } catch (e) {
            // May fail in browser mode or if Tauri is not available
            console.debug('[AssetSystem] Backend save skipped:', e);
        }
    }

    /**
     * Update system metadata (name, source).
     */
    public updateSys(id: string, sysUpdates: Partial<AssetSysMetadata>) {
        const { assets } = this.store;
        const asset = assets[id];
        if (!asset) return;

        const updatedAsset = {
            ...asset,
            sys: {
                ...asset.sys,
                ...sysUpdates,
                updatedAt: Date.now()
            }
        } as Asset;

        this.setAssets({
            ...assets,
            [id]: updatedAsset
        });

        // Persist to backend (no history created since value unchanged)
        this.saveAssetToBackend(updatedAsset).catch(err => {
            console.warn('Failed to persist asset sys:', err);
        });
    }

    /**
     * Delete an asset from both frontend store and backend database.
     * This is the single source of truth for asset deletion.
     * @param id - The asset ID to delete
     * @param deleteFiles - Whether to delete physical files (default: true)
     */
    public async delete(id: string, deleteFiles: boolean = true): Promise<void> {
        // 1. Delete from frontend Zustand store (immediate UI update)
        const { assets } = this.store;
        const { [id]: deleted, ...remainingAssets } = assets;
        this.setAssets(remainingAssets);

        // 2. Delete from backend database (async, but we await to ensure consistency)
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('delete_media_asset', { assetId: id, deleteFiles });
        } catch (e) {
            // May fail in browser mode or if asset doesn't exist in DB
            console.debug('[AssetSystem] Backend delete skipped:', e);
        }
    }

    /**
     * Clean up orphan assets that are not referenced by any node.
     * Backend scans:
     * 1. nodes.data_json for assetId references (most nodes)
     * 2. assets.value_json for mediaAssetId references (Gallery nodes)
     * @returns Result with deleted count and IDs
     */
    public async cleanupOrphans(): Promise<{ deletedCount: number; deletedAssetIds: string[] }> {
        try {
            const result = await apiClient.cleanupOrphanAssets();

            if (result.deletedCount > 0) {
                // Sync: remove deleted assets from frontend store
                const { assets } = this.store;
                const newAssets = { ...assets };
                for (const id of result.deletedAssetIds) {
                    delete newAssets[id];
                }
                this.setAssets(newAssets);
            }

            return result;
        } catch (e) {
            console.error('[AssetSystem] Cleanup orphans failed:', e);
            throw e;
        }
    }

    public get(id: string): Asset | undefined {
        return this.store.assets[id];
    }
}
