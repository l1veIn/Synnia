// ==========================================
// Synnia Architecture V2: Asset Types
// ==========================================

// Re-export types from Rust bindings (single source of truth)
export type {
    Asset as RustAsset,
    AssetMetadata,
    ImageAssetMetadata,
    TextAssetMetadata
} from '@/bindings';

import type { Asset as RustAsset, AssetMetadata, ImageAssetMetadata, TextAssetMetadata } from '@/bindings';

export type AssetType = 'text' | 'image' | 'json' | 'script' | 'file' | string;

// Alias for backward compatibility
export type ImageMetadata = ImageAssetMetadata;
export type TextMetadata = TextAssetMetadata;

// Extended metadata is now just AssetMetadata from Rust
export type ExtendedMetadata = AssetMetadata;

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
    hidden?: boolean;   // Whether to hide in Inspector (for mixin overrides)
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
    image: null,
    text: null,
    extra: {}
});
