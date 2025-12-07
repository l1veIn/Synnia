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

// ==========================================
// Form / Recipe Schema Definitions
// ==========================================

export type FieldType = 'string' | 'number' | 'boolean' | 'select';
export type WidgetType = 'text' | 'textarea' | 'password' | 'number' | 'slider' | 'switch' | 'select';

export interface FieldRule {
    min?: number;
    max?: number;
    step?: number;
    options?: string[]; // For select
    required?: boolean;
    placeholder?: string;
}

export interface FieldDefinition {
    id: string; // Internal ID for UI key stability
    key: string; // The actual variable name
    label?: string; // Human readable label
    type: FieldType;
    widget?: WidgetType;
    rules?: FieldRule;
    defaultValue?: any;
}

export interface FormAssetContent {
    schema: FieldDefinition[];
    values: Record<string, any>;
}

export const isFormAsset = (content: any): content is FormAssetContent => {
    return content && typeof content === 'object' && Array.isArray(content.schema);
};

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
