import { GraphEngine } from './GraphEngine';
import { Asset, ValueType, AssetSysMetadata, createSysMetadata } from '@/types/assets';
import { useWorkflowStore } from '@/store/workflowStore';
import { v4 as uuidv4 } from 'uuid';

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
            valueMeta?: any;
            source?: 'user' | 'ai' | 'import';
        } = {}
    ): string {
        const id = uuidv4();
        const now = Date.now();

        const sys: AssetSysMetadata = {
            name: options.name || 'New Asset',
            createdAt: now,
            updatedAt: now,
            source: options.source || 'user',
        };

        // Build the asset based on valueType
        const newAsset: Asset = {
            id,
            valueType,
            value,
            valueMeta: options.valueMeta,
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
     * Create an asset from a partial definition (used by node factories).
     */
    public createFromPartial(partial: Partial<Asset> & { valueType: ValueType; value: any }, name?: string): string {
        const id = uuidv4();
        const now = Date.now();

        const newAsset: Asset = {
            id,
            valueType: partial.valueType,
            value: partial.value,
            valueMeta: partial.valueMeta,
            config: partial.config,
            sys: partial.sys || {
                name: name || 'New Asset',
                createdAt: now,
                updatedAt: now,
                source: 'user',
            },
        } as Asset;

        const { assets } = this.store;
        this.setAssets({ ...assets, [id]: newAsset });
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

        // Save to backend for history tracking (async, fire-and-forget)
        this.saveAssetToBackend(updatedAsset).catch(err => {
            console.warn('Failed to save asset history:', err);
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
                updatedAt: Date.now()
            }
        } as Asset;

        this.setAssets({
            ...assets,
            [id]: updatedAsset
        });
    }

    /**
     * Save asset to backend for history tracking.
     * This creates a history snapshot if content has changed.
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

        this.setAssets({
            ...assets,
            [id]: {
                ...asset,
                sys: {
                    ...asset.sys,
                    ...sysUpdates,
                    updatedAt: Date.now()
                }
            } as Asset
        });
    }

    public delete(id: string) {
        const { assets } = this.store;
        const { [id]: deleted, ...remainingAssets } = assets;
        this.setAssets(remainingAssets);
    }

    public get(id: string): Asset | undefined {
        return this.store.assets[id];
    }
}
