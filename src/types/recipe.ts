import { LucideIcon } from 'lucide-react';
import { FieldDefinition } from './assets';
import { NodeType, BaseNodeData, SynniaNode } from './project';
import { GraphEngine } from '@core/engine/GraphEngine';
import { XYPosition } from '@xyflow/react';
import { WidgetType } from './widgets';

// ============================================================================
// Recipe System V2: YAML-based Configuration + Executor Pattern
// ============================================================================

// ----------------------------------------------------------------------------
// Manifest Schema (maps to YAML structure)
// ----------------------------------------------------------------------------

/**
 * Field definition in YAML format (simplified from FieldDefinition)
 */
export interface ManifestField {
    key: string;
    label?: string;
    type: 'string' | 'number' | 'boolean' | 'select' | 'object';
    widget?: WidgetType;
    default?: any;
    required?: boolean;
    disabled?: boolean;
    hidden?: boolean;
    placeholder?: string;
    // Number constraints
    min?: number;
    max?: number;
    step?: number;
    // Select options
    options?: string[];
    // Connection configuration
    connection?: {
        input?: boolean;
        output?: boolean;
    };
    // Widget specific configuration
    filterRecipeType?: string;
    // Nested rules object (from YAML)
    rules?: {
        requiredKeys?: string[];
        filterCapability?: string;
        [key: string]: any;
    };
}

// Output schema is defined in executor.output.schema

/**
 * Base executor configuration - extensible pattern
 * Each executor defines its own config type extending this base
 * 
 * Built-in types: 'template', 'expression', 'http', 'llm-agent', 'media', 'custom'
 * Custom types can be added by creating new executor files in impl/
 */
export interface ExecutorConfig {
    /** Executor type - matches the filename in executors/impl/ */
    type: string;
    /** Output key for result data (optional, executor-specific) */
    outputKey?: string;
    /** Allow any additional properties for flexibility */
    [key: string]: any;
}

/**
 * Output configuration - how to create product nodes
 * Uses "Universal Output Adapter" pattern: all node-specific config goes into `config`
 */
export interface OutputConfig {
    /** Target node type (alias like 'form', 'gallery', 'table', 'selector') */
    node: string;
    /** Title template - supports {{count}}, {{index}}, {{fieldName}} */
    title?: string;
    /** Whether output node starts collapsed */
    collapsed?: boolean;
    /** 
     * Node-specific configuration - transparently passed to asset.config
     * Examples:
     * - schema: field definitions for Form/Table/Selector
     * - mode: 'single' | 'multi' for Selector
     * - viewMode: 'grid' | 'list' for Gallery
     */
    config?: Record<string, any>;
}

/**
 * Recipe Manifest - the YAML configuration structure
 */
export interface RecipeManifest {
    // Schema version for future migrations
    version: 1;

    // Basic info
    id: string;
    name: string;
    description?: string;
    category?: string;
    icon?: string; // Lucide icon name or './icon.svg'

    // Inheritance
    mixin?: string[];

    // Schema
    inputSchema: ManifestField[];
    // Output schema is defined in executor.output.schema

    // Executor
    executor: ExecutorConfig;
}

// ----------------------------------------------------------------------------
// Runtime Types (used by the engine)
// ----------------------------------------------------------------------------

/**
 * Execution context passed to recipe execute() method.
 */
export interface ExecutionContext {
    /** Resolved input values (connections already dereferenced) */
    inputs: Record<string, any>;
    /** Current node ID */
    nodeId: string;
    /** Reference to GraphEngine for node/edge creation */
    engine: GraphEngine;
    /** Current node instance */
    node: SynniaNode;
    /** Recipe manifest (for accessing config) */
    manifest: RecipeManifest;

    // --- Recipe V2: Agent Container Support ---

    /** Chat history for multi-turn conversations */
    chatContext?: import('./assets').ChatMessage[];
    /** Model configuration (selected model and parameters) */
    modelConfig?: import('./assets').ModelConfig;
}


/**
 * Result returned by recipe execute() method.
 */
export interface ExecutionResult {
    /** Whether execution succeeded */
    success: boolean;
    /** Output data */
    data?: any;
    /** Request to create product nodes */
    createNodes?: {
        type: NodeType | string;  // Allow string for flexibility (e.g., 'selector', 'json')
        data: Partial<BaseNodeData>;
        position?: 'below' | 'right' | XYPosition;
        dockedTo?: string | '$prev';
        connectTo?: { sourceHandle: string; targetHandle: string };
        assetConfig?: Record<string, any>;  // Universal Output Adapter: passed to asset.config
    }[];
    /** Error message if success is false */
    error?: string;
}

/**
 * Executor function signature
 */
export type RecipeExecutor = (ctx: ExecutionContext) => Promise<ExecutionResult>;

/**
 * Recipe Definition - runtime representation
 * Created from RecipeManifest by the loader
 */
export interface RecipeDefinition {
    /** Unique recipe ID */
    id: string;
    /** Display name */
    name: string;
    /** Description */
    description?: string;
    /** Lucide icon */
    icon?: LucideIcon;
    /** Category for grouping */
    category?: string;
    /** Input fields schema (resolved from manifest + mixins) */
    inputSchema: FieldDefinition[];
    /** The manifest this was created from */
    manifest: RecipeManifest;
    /** Core execution logic */
    execute: RecipeExecutor;
    /** Mixin IDs */
    mixin?: string[];
}

// ----------------------------------------------------------------------------
// Utility Types
// ----------------------------------------------------------------------------

/**
 * Type-safe helper for defining recipes (legacy, for custom executors)
 */
export const defineRecipe = (def: Omit<RecipeDefinition, 'manifest'>): Omit<RecipeDefinition, 'manifest'> => def;

/**
 * Convert ManifestField to FieldDefinition
 */
export const manifestFieldToDefinition = (field: ManifestField): FieldDefinition => ({
    id: field.key,
    key: field.key,
    label: field.label,
    type: field.type,
    widget: field.widget,
    defaultValue: field.default,
    disabled: field.disabled,
    hidden: field.hidden,
    options: field.options, // Widget-specific options (e.g. category for model-configurator)
    rules: {
        required: field.required,
        placeholder: field.placeholder,
        min: field.min,
        max: field.max,
        step: field.step,
        filterRecipeType: field.filterRecipeType,
        // Merge nested rules from YAML
        ...field.rules,
    },
    connection: field.connection,
});
