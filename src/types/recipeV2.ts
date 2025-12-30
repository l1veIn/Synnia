/**
 * Recipe V2 Types - Flat prompt template model
 * No mixin inheritance, self-contained recipes
 */

import type { ModelCapability } from '@features/models/types';

// ============================================================================
// Input Field Definition (Simplified)
// ============================================================================

export interface ManifestFieldV2 {
    key: string;
    label?: string;
    type: 'string' | 'number' | 'boolean' | 'select';
    required?: boolean;
    placeholder?: string;
    default?: any;

    // Widget override
    widget?: 'text' | 'textarea' | 'number' | 'switch' | 'select';

    // Select options
    options?: string[];

    // Connection (simplified from V1)
    connection?: 'input' | 'output' | 'both';
}

// ============================================================================
// Model Requirements
// ============================================================================

export interface ModelRequirements {
    /** Model category: llm, image-generation, video-generation */
    category: 'llm' | 'image-generation' | 'video-generation';

    /** Required capabilities (e.g., 'vision', 'chat', 'json-mode') */
    capabilities?: ModelCapability[];

    /** Default parameters (user can override in Model Tab) */
    defaultParams?: {
        temperature?: number;
        maxTokens?: number;
        jsonMode?: boolean;
    };
}

// ============================================================================
// Prompt Templates
// ============================================================================

export interface PromptTemplates {
    /** System prompt - sets AI behavior/persona */
    system: string;

    /** User prompt template - first turn only, supports {{variables}} */
    user: string;
}

// ============================================================================
// Output Definition
// ============================================================================

export interface OutputDefinition {
    /** Expected output format */
    format: 'json' | 'text' | 'markdown';

    /** Output node type (e.g., 'selector', 'form', 'gallery') */
    node?: string;

    /** Title template for output node */
    title?: string;

    /** Whether output node starts collapsed */
    collapsed?: boolean;

    /** 
     * Node-specific configuration - transparently passed to asset.config
     * (Universal Output Adapter pattern)
     */
    config?: Record<string, any>;
}

// ============================================================================
// Advanced Options
// ============================================================================

export interface AdvancedOptions {
    /** Enable streaming output */
    streaming?: boolean;

    /** Enable multi-turn conversation (Chat Tab) */
    multiTurn?: boolean;

    /** Retry on error */
    retryOnError?: boolean;
}

// ============================================================================
// Recipe Manifest V2 - Main Type
// ============================================================================

export interface RecipeManifestV2 {
    /** Schema version - must be 2 */
    version: 2;

    // ---------- Identity ----------

    /** Unique recipe ID */
    id: string;

    /** Display name */
    name: string;

    /** Description */
    description?: string;

    /** Category for grouping (e.g., 'Agent', 'Utility') */
    category?: string;

    /** Lucide icon name */
    icon?: string;

    // ---------- Configuration ----------

    /** Input form fields */
    input: ManifestFieldV2[];

    /** Model requirements and defaults */
    model: ModelRequirements;

    /** Prompt templates */
    prompt: PromptTemplates;

    /** Output definition */
    output: OutputDefinition;

    /** Advanced options */
    advanced?: AdvancedOptions;
}

// ============================================================================
// Conversion Utilities
// ============================================================================

import type { FieldDefinition } from './assets';

/**
 * Convert ManifestFieldV2 to FieldDefinition (for runtime use)
 */
export function manifestFieldV2ToDefinition(field: ManifestFieldV2): FieldDefinition {
    return {
        id: field.key,
        key: field.key,
        label: field.label,
        type: field.type,
        widget: field.widget,
        defaultValue: field.default,
        options: field.options,
        rules: {
            required: field.required,
            placeholder: field.placeholder,
        },
        connection: field.connection ? {
            input: field.connection === 'input' || field.connection === 'both',
            output: field.connection === 'output' || field.connection === 'both',
        } : undefined,
    };
}
