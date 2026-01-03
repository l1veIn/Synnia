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
    source: string;  // Backend uses string, not union
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
    valueMeta: TextAssetValueMeta;   // Required to match backend
    config: TextAssetConfig | null;  // Required to match backend (nullable)
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
    valueMeta: ImageAssetValueMeta;   // Required to match backend
    config: ImageAssetConfig | null;  // Required to match backend (nullable)
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
    valueMeta: RecordAssetValueMeta;   // Required to match backend
    config: RecordAssetConfig;
}

// ==========================================
// Recipe V2: Model & Chat Types
// ==========================================

/**
 * AI Model Configuration
 * Stores the selected model and its parameters for a Recipe
 */
export interface ModelConfig {
    modelId: string;       // e.g., 'gpt-4-turbo'
    provider?: string;     // e.g., 'openai'
    params?: Record<string, any>; // e.g., { temperature: 0.7 }
}

/**
 * Reference to another asset (for multi-modal or RAG)
 */
export interface AssetReference {
    assetId: string;
    type: 'image' | 'text' | 'file';
}

/**
 * Chat Message Structure for multi-turn conversations
 */
export interface ChatMessage {
    id: string;              // Unique ID
    role: 'system' | 'user' | 'assistant';
    content: string;         // Text content
    timestamp: number;

    // References to other assets (for multi-modal or RAG)
    attachments?: AssetReference[];

    // Link to generated output (for 'assistant' messages)
    outputAssetId?: string;
}

/**
 * Chat Context - stores conversation history for a Recipe
 */
export interface ChatContext {
    messages: ChatMessage[];
}

/**
 * Recipe-specific Asset Configuration
 * Extends RecordAssetConfig with model and chat context
 */
export interface RecipeAssetConfig extends RecordAssetConfig {
    // The ID of the recipe definition (e.g., 'text-generator')
    recipeId: string;

    // AI Model Configuration
    modelConfig?: ModelConfig;

    // Conversation History
    chatContext?: ChatContext;
}


// ==========================================
// Array Asset (Tables, Selectors, Galleries)
// ==========================================

export interface ArrayAssetValueMeta {
    length?: number;
}

export interface ArrayAssetConfig {
    // Unified structure definition (replaces itemSchema, columns, optionSchema)
    schema?: FieldDefinition[];

    // @deprecated - use schema instead
    itemSchema?: FieldDefinition[];
    columns?: ColumnDef[];

    // Selector-specific
    options?: SelectorOption[];
    mode?: 'single' | 'multi';
}

export interface ArrayAsset extends BaseAsset {
    valueType: 'array';
    value: any[];
    valueMeta: ArrayAssetValueMeta;   // Required to match backend
    config: ArrayAssetConfig | null;  // Required to match backend (nullable)
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

/**
 * Field types supported by the schema system.
 * - string, number, boolean: primitive types
 * - object: nested form (has schema)
 * - array: collection of items (has schema for item structure)
 */
export type FieldType = 'string' | 'number' | 'boolean' | 'object' | 'array';

/**
 * Unified field definition for forms, recipes, tables, and selectors.
 * Supports recursive nesting via `schema` property.
 */
export interface FieldDefinition {
    /** Unique field identifier */
    key: string;

    /** Data type */
    type: FieldType;

    /** Display label */
    label?: string;

    /** Widget to render this field */
    widget?: WidgetType;

    /** Whether this field is required */
    required?: boolean;

    /** Hide this field from UI */
    hidden?: boolean;

    /** Default value */
    defaultValue?: any;

    /**
     * Widget-specific configuration.
     * Examples: { min: 0, max: 100 }, { options: ['a', 'b'] }, { placeholder: '...' }
     */
    config?: Record<string, any>;

    /**
     * Connection configuration for canvas nodes.
     * - 'input': can receive connections
     * - 'output': can send connections
     * - 'both': bidirectional
     * - false: no connections
     */
    connection?: 'input' | 'output' | 'both' | false;

    /**
     * Nested schema for object/array types.
     * - For type: 'object' → describes the object's fields
     * - For type: 'array' → describes each array item's fields
     */
    schema?: FieldDefinition[];
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

export function createTextAsset(id: string, value: string, name: string, config?: TextAssetConfig | null): TextAsset {
    return {
        id,
        valueType: 'text',
        value,
        valueMeta: { length: value.length, preview: value.slice(0, 100) },
        config: config ?? null,
        sys: createSysMetadata(name),
    };
}

export function createImageAsset(id: string, value: string, name: string, config?: ImageAssetConfig | null): ImageAsset {
    return {
        id,
        valueType: 'image',
        value,
        valueMeta: {},  // Required empty object
        config: config ?? null,
        sys: createSysMetadata(name),
    };
}

export function createRecordAsset(id: string, value: Record<string, any>, schema: FieldDefinition[], name: string): RecordAsset {
    return {
        id,
        valueType: 'record',
        value,
        valueMeta: {},  // Required empty object
        config: { schema },
        sys: createSysMetadata(name),
    };
}

export function createArrayAsset(id: string, value: any[], name: string, config?: ArrayAssetConfig | null): ArrayAsset {
    return {
        id,
        valueType: 'array',
        value,
        valueMeta: { length: value.length },
        config: config ?? null,
        sys: createSysMetadata(name),
    };
}
