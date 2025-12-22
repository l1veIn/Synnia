// ==========================================
// Synnia Asset Types
// Unified Asset Model with Discriminated Union
// ==========================================

import { WidgetType } from './widgets';
export { type WidgetType };

// ==========================================
// Core Types
// ==========================================

/**
 * Value types supported by the Asset system
 */
export type ValueType = 'text' | 'image' | 'record' | 'array';

/**
 * System metadata - tracks asset lifecycle
 */
export interface AssetSysMetadata {
    name: string;
    createdAt: number;
    updatedAt: number;
    source: 'user' | 'ai' | 'import';
}

// ==========================================
// Base Asset Interface
// ==========================================

interface BaseAsset {
    id: string;
    sys: AssetSysMetadata;
}

// ==========================================
// Text Asset
// ==========================================

export interface TextAssetValueMeta {
    preview?: string;
    length?: number;
}

export interface TextAssetConfig {
    format?: 'markdown' | 'plain' | 'json';
}

export interface TextAsset extends BaseAsset {
    valueType: 'text';
    value: string;
    valueMeta?: TextAssetValueMeta;
    config?: TextAssetConfig;
}

// ==========================================
// Image Asset
// ==========================================

export interface ImageAssetValueMeta {
    preview?: string;
    width?: number;
    height?: number;
}

export interface ImageAssetConfig {
    mimeType?: string;
}

export interface ImageAsset extends BaseAsset {
    valueType: 'image';
    value: string;
    valueMeta?: ImageAssetValueMeta;
    config?: ImageAssetConfig;
}

// ==========================================
// Record Asset (Forms)
// ==========================================

export interface RecordAssetValueMeta {
    preview?: string;
}

export interface RecordAssetConfig {
    schema: FieldDefinition[];
}

export interface RecordAsset extends BaseAsset {
    valueType: 'record';
    value: Record<string, any>;
    valueMeta?: RecordAssetValueMeta;
    config: RecordAssetConfig;
}

// ==========================================
// Array Asset (Tables, Selectors, Galleries)
// ==========================================

export interface ArrayAssetValueMeta {
    length?: number;
}

export interface ArrayAssetConfig {
    itemSchema?: FieldDefinition[];
    columns?: ColumnDef[];
    options?: SelectorOption[];
    mode?: 'single' | 'multi';
}

export interface ArrayAsset extends BaseAsset {
    valueType: 'array';
    value: any[];
    valueMeta?: ArrayAssetValueMeta;
    config?: ArrayAssetConfig;
}

// ==========================================
// Union Type: Asset
// ==========================================

export type Asset = TextAsset | ImageAsset | RecordAsset | ArrayAsset;

// ==========================================
// Type Guards
// ==========================================

export function isTextAsset(asset: Asset): asset is TextAsset {
    return asset.valueType === 'text';
}

export function isImageAsset(asset: Asset): asset is ImageAsset {
    return asset.valueType === 'image';
}

export function isRecordAsset(asset: Asset): asset is RecordAsset {
    return asset.valueType === 'record';
}

export function isArrayAsset(asset: Asset): asset is ArrayAsset {
    return asset.valueType === 'array';
}

// ==========================================
// Asset Reference Utilities
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
// Form / Recipe Schema Definitions
// ==========================================

export type FieldType = 'string' | 'number' | 'boolean' | 'select' | 'object';

export interface FieldRule {
    min?: number;
    max?: number;
    step?: number;
    options?: string[];
    requiredKeys?: string[];
    required?: boolean;
    placeholder?: string;
    pattern?: string;
    patternMessage?: string;
    minLength?: number;
    maxLength?: number;
    enum?: (string | number)[];
    format?: 'email' | 'url' | 'date' | 'datetime' | 'uuid';
    customValidator?: string;
    filterRecipeType?: string;
    filterCapability?: string;
}

export interface FieldConnection {
    /** @deprecated Use input.enabled or output.enabled instead */
    enabled?: boolean;
    input?: boolean | {
        enabled: boolean;
        acceptTypes?: ('text' | 'image' | 'json' | 'any')[];
    };
    output?: boolean | {
        enabled: boolean;
        handleId?: string;
    };
}

export interface FieldDefinition {
    id?: string;
    key: string;
    label?: string;
    type: FieldType;
    widget?: WidgetType;
    rules?: FieldRule;
    connection?: FieldConnection;
    defaultValue?: any;
    disabled?: boolean;
    hidden?: boolean;
    options?: Record<string, any>;
}

// ==========================================
// Supporting Types
// ==========================================

export interface ColumnDef {
    key: string;
    label: string;
    type: 'string' | 'number' | 'boolean';
    width?: number;
    editable?: boolean;
}

export interface SelectorOption {
    id: string;
    [key: string]: any;
}

// ==========================================
// Factory Helpers
// ==========================================

export function createSysMetadata(name: string): AssetSysMetadata {
    const now = Date.now();
    return { name, createdAt: now, updatedAt: now, source: 'user' };
}

export function createTextAsset(id: string, value: string, name: string, config?: TextAssetConfig): TextAsset {
    return {
        id,
        valueType: 'text',
        value,
        valueMeta: { length: value.length, preview: value.slice(0, 100) },
        config,
        sys: createSysMetadata(name),
    };
}

export function createImageAsset(id: string, value: string, name: string, config?: ImageAssetConfig): ImageAsset {
    return {
        id,
        valueType: 'image',
        value,
        config,
        sys: createSysMetadata(name),
    };
}

export function createRecordAsset(id: string, value: Record<string, any>, schema: FieldDefinition[], name: string): RecordAsset {
    return {
        id,
        valueType: 'record',
        value,
        config: { schema },
        sys: createSysMetadata(name),
    };
}

export function createArrayAsset(id: string, value: any[], name: string, config?: ArrayAssetConfig): ArrayAsset {
    return {
        id,
        valueType: 'array',
        value,
        valueMeta: { length: value.length },
        config,
        sys: createSysMetadata(name),
    };
}

// ==========================================
// Legacy Compatibility (FormAssetContent)
// TODO: Remove after migrating RecipeNode
// ==========================================

export interface FormAssetContent {
    schema: FieldDefinition[];
    values: Record<string, any>;
}

export const isFormAsset = (content: any): content is FormAssetContent => {
    return content && typeof content === 'object' && Array.isArray(content.schema);
};
