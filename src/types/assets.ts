// ==========================================
// Synnia Architecture V2: Asset Types
// ==========================================

import { Asset as RustAsset, AssetMetadata as RustMetadata } from '@/bindings/synnia';

export type AssetType = 'text' | 'image' | 'json' | 'script' | 'file' | string;

export type AssetMetadata = RustMetadata;

/**
 * The unified Asset interface for the frontend Asset Store.
 * Extends the Rust binding with generic content support.
 */
export interface Asset<T = any> extends Omit<RustAsset, 'content' | 'type'> {
    type: AssetType;
    content: T; 
}

// Helper: Factory for creating default assets
export const createDefaultMetadata = (name: string): AssetMetadata => ({
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    source: 'user',
    extra: {}
});
