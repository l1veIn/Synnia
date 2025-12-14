import { GraphEngine } from './GraphEngine';
import { Asset, ExtendedMetadata } from '@/types/assets';
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

    public create(type: string, content: any, metadata: Partial<Asset['metadata']> = {}): string {
        const id = uuidv4();
        const now = Date.now();

        // Ensure metadata conforms to Rust binding structure
        const safeMetadata: Asset['metadata'] = {
            name: metadata.name || 'New Asset',
            createdAt: metadata.createdAt || now,
            updatedAt: metadata.updatedAt || now,
            source: metadata.source ?? 'user',
            image: metadata.image ?? null,
            text: metadata.text ?? null,
            extra: metadata.extra || {},
        };

        const newAsset: Asset = {
            id,
            type,
            content,
            metadata: safeMetadata
        };

        const { assets } = this.store;
        this.setAssets({ ...assets, [id]: newAsset });

        // Save initial version to backend (creates first history entry)
        this.saveAssetToBackend(newAsset);

        return id;
    }

    public update(id: string, content: any) {
        const { assets } = this.store;
        const asset = assets[id];
        if (!asset) {
            console.warn(`Attempted to update non-existent asset ${id}`);
            return;
        }

        const updatedAsset = {
            ...asset,
            content,
            metadata: {
                ...asset.metadata,
                updatedAt: Date.now()
            }
        };

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

    public updateMetadata(id: string, metaUpdates: Partial<Asset['metadata']>) {
        const { assets } = this.store;
        const asset = assets[id];
        if (!asset) return;

        this.setAssets({
            ...assets,
            [id]: {
                ...asset,
                metadata: {
                    ...asset.metadata,
                    ...metaUpdates,
                    updatedAt: Date.now()
                }
            }
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
