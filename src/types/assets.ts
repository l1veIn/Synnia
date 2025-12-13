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

export type FieldType = 'string' | 'number' | 'boolean' | 'select' | 'object';
export type WidgetType = 'text' | 'textarea' | 'password' | 'number' | 'slider' | 'switch' | 'select' | 'node-input' | 'none';

export interface FieldRule {
    min?: number;
    max?: number;
    step?: number;
    options?: string[]; // For select
    requiredKeys?: string[]; // For object (validation)
    required?: boolean;
    placeholder?: string;
    // --- V2: Enhanced Validation Rules ---
    pattern?: string;              // Regex pattern
    patternMessage?: string;       // Custom error message for pattern validation
    minLength?: number;            // Minimum string length
    maxLength?: number;            // Maximum string length
    enum?: (string | number)[];    // Allowed values list
    format?: 'email' | 'url' | 'date' | 'datetime' | 'uuid'; // Built-in format presets
    customValidator?: string;      // Function name for custom validation (advanced)
}

export interface FieldConnection {
    /** 
     * Input handle (left side) - allows data to flow INTO this field
     * true = simple enable, object = advanced config
     */
    input?: boolean | {
        enabled: boolean;
        acceptTypes?: ('text' | 'image' | 'json' | 'any')[];
    };
    /** 
     * Output handle (right side) - exposes this field's value as an output
     * true = simple enable, object = advanced config
     */
    output?: boolean | {
        enabled: boolean;
        handleId?: string; // Custom handle ID, defaults to field.key
    };

    // Legacy fields (deprecated, use input/output instead)
    enabled?: boolean;
    supportedTypes?: string[];
}

export interface FieldDefinition {
    id: string; // Internal ID for UI key stability
    key: string; // The actual variable name
    label?: string; // Human readable label
    type: FieldType;
    widget?: WidgetType;
    rules?: FieldRule;
    connection?: FieldConnection;
    defaultValue?: any;
    disabled?: boolean; // Whether the field is read-only
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
