// ==========================================
// Synnia Architecture V2: Asset Types
// ==========================================

import { Asset as RustAsset, AssetMetadata as RustMetadata } from '@/bindings/synnia';

export type AssetType = 'text' | 'image' | 'json' | 'script' | 'file' | string;

export interface ImageMetadata {
    width: number;
    height: number;
    size: number;
    mimeType: string;
    thumbnail?: string; // Base64 data URI
    hash?: string;
}

export interface TextMetadata {
    length: number;
    encoding?: string;
}

// Frontend Metadata Extension (maps to 'extra' or extended fields)
export interface ExtendedMetadata extends RustMetadata {
    image?: ImageMetadata;
    text?: TextMetadata;
}

/**
 * The unified Asset interface for the frontend Asset Store.
 */
export interface Asset<T = any> extends Omit<RustAsset, 'content' | 'type' | 'metadata'> {
    type: AssetType;
    content: T; 
    metadata: ExtendedMetadata;
}

// Helper: Factory for creating default metadata
export const createDefaultMetadata = (name: string): ExtendedMetadata => ({
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    source: 'user',
    extra: {}
});
