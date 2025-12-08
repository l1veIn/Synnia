import { GraphEngine } from './GraphEngine';
import { Asset } from '@/bindings/Asset';
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
        const safeMetadata = {
            name: metadata.name || 'New Asset',
            createdAt: metadata.createdAt || now,
            updatedAt: metadata.updatedAt || now,
            source: metadata.source || 'user',
            extra: metadata.extra || {},
            ...metadata
        };

        const newAsset: Asset = {
            id,
            type,
            content,
            metadata: safeMetadata
        };

        const { assets } = this.store;
        this.setAssets({ ...assets, [id]: newAsset });
        
        return id;
    }

    public update(id: string, content: any) {
        const { assets } = this.store;
        const asset = assets[id];
        if (!asset) {
            console.warn(`Attempted to update non-existent asset ${id}`);
            return;
        }

        this.setAssets({
            ...assets,
            [id]: {
                ...asset,
                content,
                metadata: {
                    ...asset.metadata,
                    updatedAt: Date.now()
                }
            }
        });
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
