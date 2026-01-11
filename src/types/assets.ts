/**
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                     📦 Synnia Asset Model                       │
 * │                 Form-Centric Unified Data Layer                 │
 * ├─────────────────────────────────────────────────────────────────┤
 * │                                                                 │
 * │                           Asset                                 │
 * │              ┌────────────┴────────────┐                        │
 * │         RecordAsset               ArrayAsset                    │
 * │      (Form, Text, Image)     (Table, Selector, Gallery)         │
 * │                                                                 │
 * │  Structure:                                                     │
 * │  ────────────────────────────────────────────────               │
 * │  Asset                                                          │
 * │  ├── id: string                                                 │
 * │  ├── valueType: 'record' | 'array'                              │
 * │  ├── value: Record<string, any> | any[]                         │
 * │  ├── valueMeta?: AssetMeta         // Backend-generated         │
 * │  ├── config                                                     │
 * │  │   ├── schema?: FieldDefinition[]                             │
 * │  │   └── extra?: Record<string, any>  // node-specific          │
 * │  └── sys: AssetSysMetadata                                      │
 * │                                                                 │
 * └─────────────────────────────────────────────────────────────────┘
 */

import { WidgetType } from './widgets';
export { type WidgetType };

// ==========================================
// 🎯 Core Types (Start Here!)
// ==========================================

/**
 * The unified Asset type - all data in Synnia is one of these two variants
 */
export type Asset = RecordAsset | ArrayAsset;

/**
 * Value types: record (single form) or array (collection)
 */
export type ValueType = 'record' | 'array';

// ==========================================
// 📋 RecordAsset (Forms, Text, Image)
// ==========================================

export interface RecordAsset extends BaseAsset {
    valueType: 'record';
    value: Record<string, any>;
    config: RecordAssetConfig;
}

export interface RecordAssetConfig {
    schema: FieldDefinition[];
    extra?: Record<string, any>;  // Node-specific extensions
}

// ==========================================
// 📊 ArrayAsset (Table, Selector, Gallery)
// ==========================================

export interface ArrayAsset extends BaseAsset {
    valueType: 'array';
    value: any[];
    config: ArrayAssetConfig;  // Required (was: | null)
}

export interface ArrayAssetConfig {
    schema?: FieldDefinition[];
    extra?: Record<string, any>;  // Node-specific extensions
}

// ==========================================
// 🔧 Supporting Types
// ==========================================

interface BaseAsset {
    id: string;
    sys: AssetSysMetadata;
    valueMeta?: AssetMeta;  // Backend-generated metadata (dimensions, preview, length)
}

export interface AssetSysMetadata {
    name: string;
    createdAt: number;
    updatedAt: number;
    source: string;
    /** If true, asset is shown in Asset Library and preserved when node is deleted */
    isLibraryAsset?: boolean;
}

export interface AssetMeta {
    preview?: string;
    length?: number;
    width?: number;
    height?: number;
}

// ==========================================
// 📐 Schema System
// ==========================================

export type FieldType = 'string' | 'number' | 'boolean' | 'object' | 'array';

export interface FieldDefinition {
    key: string;
    type: FieldType;
    label?: string;
    widget?: WidgetType;
    required?: boolean;
    hidden?: boolean;
    defaultValue?: any;
    config?: Record<string, any>;
    connection?: 'input' | 'output' | 'both' | false;
    schema?: FieldDefinition[];  // Nested schema for object/array
}

// ==========================================
// 🛡️ Type Guards
// ==========================================

export function isRecordAsset(asset: Asset): asset is RecordAsset {
    return asset.valueType === 'record';
}

export function isArrayAsset(asset: Asset): asset is ArrayAsset {
    return asset.valueType === 'array';
}

// ==========================================
// 🔗 Asset Reference Utilities
// ==========================================

const ASSET_REF_PREFIX = 'asset:';

export function isAssetRef(value: any): value is string {
    return typeof value === 'string' && value.startsWith(ASSET_REF_PREFIX);
}

export function toAssetRef(assetId: string): string {
    return `${ASSET_REF_PREFIX}${assetId}`;
}

export function fromAssetRef(ref: string): string {
    return ref.replace(ASSET_REF_PREFIX, '');
}

// ==========================================
// 🏭 Factory Helpers
// ==========================================

export function createSysMetadata(name: string): AssetSysMetadata {
    const now = Date.now();
    return { name, createdAt: now, updatedAt: now, source: 'user' };
}

export function createRecordAsset(
    id: string,
    value: Record<string, any>,
    schema: FieldDefinition[],
    name: string,
    valueMeta?: AssetMeta
): RecordAsset {
    return {
        id,
        valueType: 'record',
        value,
        valueMeta,
        config: { schema },
        sys: createSysMetadata(name),
    };
}

export function createArrayAsset(
    id: string,
    value: any[],
    name: string,
    config?: Partial<ArrayAssetConfig>,
    valueMeta?: AssetMeta
): ArrayAsset {
    return {
        id,
        valueType: 'array',
        value,
        valueMeta,
        config: { ...config },
        sys: createSysMetadata(name),
    };
}

// ==========================================
// 📦 Backward Compatibility
// ==========================================

/**
 * @deprecated Use RecordAssetConfig with extra for Recipe-specific fields
 * Recipe types are now in src/features/recipes/types.ts
 */
export type RecipeAssetConfig = RecordAssetConfig;
