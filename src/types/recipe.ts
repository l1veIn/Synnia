import { LucideIcon } from 'lucide-react';
import { FieldDefinition } from './assets';
import { NodeType, BaseNodeData, SynniaNode } from './project';
import { GraphEngine } from '@/lib/engine/GraphEngine';
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

// OutputSchema removed - use executor.nodeConfig.schema instead for output definitions

/**
 * Executor types available
 */
export type ExecutorType = 'template' | 'http' | 'llm-agent' | 'custom' | 'expression' | 'media';

/**
 * Base executor configuration
 */
export interface BaseExecutorConfig {
    type: ExecutorType;
}

/**
 * Template executor: simple string interpolation
 */
export interface TemplateExecutorConfig extends BaseExecutorConfig {
    type: 'template';
    template: string;
    outputKey?: string; // Default: 'result'
}

/**
 * Expression executor: JavaScript expression evaluation
 */
export interface ExpressionExecutorConfig extends BaseExecutorConfig {
    type: 'expression';
    expression: string;
    outputKey?: string;
}

/**
 * HTTP executor: make HTTP requests
 */
export interface HttpExecutorConfig extends BaseExecutorConfig {
    type: 'http';
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    body?: string; // Template string
    responseType?: 'json' | 'text';
    outputKey?: string;
}

/**
 * Node creation configuration for executors
 * Allows declarative specification of what type of node to create
 */
export interface NodeCreationConfig {
    // Node type: 'auto' means infer from data (default: json)
    type: NodeType | 'json' | 'selector' | 'table' | 'auto';
    titleTemplate?: string;
    collapsed?: boolean;

    // Schema configuration
    // 'auto' = infer from data keys (default)
    // ManifestField[] = explicit schema definition
    schema?: 'auto' | ManifestField[];

    // Selector node specific
    selectorMode?: 'single' | 'multi';

    // Table node specific (future)
    // ...
}

/**
 * LLM Agent executor: call LLM with prompts
 */
export interface LlmAgentExecutorConfig extends BaseExecutorConfig {
    type: 'llm-agent';
    systemPrompt?: string;
    userPromptTemplate: string;
    parseAs?: 'json' | 'text';
    temperature?: number;
    maxTokens?: number;
    // Node creation config
    createNodes?: boolean;
    nodeConfig?: NodeCreationConfig;
}

/**
 * Custom executor: load from TypeScript file
 */
export interface CustomExecutorConfig extends BaseExecutorConfig {
    type: 'custom';
    executorPath: string; // Relative path like './executor.ts'
}

/**
 * Media executor: generate images/videos/audio
 */
export interface MediaExecutorConfig extends BaseExecutorConfig {
    type: 'media';
    mode: 'image-generation' | 'video-generation';
    outputNode?: {
        type: 'gallery' | 'video' | 'audio';
        titleTemplate?: string;
    };
}

export type ExecutorConfig =
    | TemplateExecutorConfig
    | ExpressionExecutorConfig
    | HttpExecutorConfig
    | LlmAgentExecutorConfig
    | MediaExecutorConfig
    | CustomExecutorConfig;

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
    // NOTE: outputSchema removed - use executor.nodeConfig.schema for output definitions

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
