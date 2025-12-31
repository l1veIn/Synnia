import { LucideIcon } from 'lucide-react';
import { FieldDefinition } from './assets';
import { NodeType, BaseNodeData, SynniaNode } from './project';
import { GraphEngine } from '@core/engine/GraphEngine';
import { XYPosition } from '@xyflow/react';
import type { ModelCapability } from '@features/models/types';

// ============================================================================
// Recipe System - YAML-based Configuration + Executor Pattern
// ============================================================================

// ----------------------------------------------------------------------------
// Input Field Definition
// ----------------------------------------------------------------------------

/**
 * Input field definition in YAML format
 */
export interface InputField {
    key: string;
    label?: string;
    type: 'string' | 'number' | 'boolean' | 'select';
    required?: boolean;
    placeholder?: string;
    default?: any;

    // Widget override
    widget?: string;

    // Select options
    options?: string[];

    // Connection (simplified)
    connection?: 'input' | 'output' | 'both';
}

// ----------------------------------------------------------------------------
// Executor Config (V1 compatibility for builtin transforms)
// ----------------------------------------------------------------------------

/**
 * Base executor configuration - extensible pattern
 * Each executor defines its own config type extending this base
 */
export interface ExecutorConfig {
    /** Executor type - matches the filename in executors/impl/ */
    type: string;
    /** Allow any additional properties for flexibility */
    [key: string]: any;
}

// ----------------------------------------------------------------------------
// Model Requirements
// ----------------------------------------------------------------------------

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

// ----------------------------------------------------------------------------
// Prompt Templates
// ----------------------------------------------------------------------------

export interface PromptTemplates {
    /** System prompt - sets AI behavior/persona */
    system: string;

    /** User prompt template - first turn only, supports {{variables}} */
    user: string;
}

// ----------------------------------------------------------------------------
// Output Definition
// ----------------------------------------------------------------------------

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

// ----------------------------------------------------------------------------
// Advanced Options
// ----------------------------------------------------------------------------

export interface AdvancedOptions {
    /** Enable streaming output */
    streaming?: boolean;

    /** Enable multi-turn conversation (Chat Tab) */
    multiTurn?: boolean;

    /** Retry on error */
    retryOnError?: boolean;
}

// ----------------------------------------------------------------------------
// Recipe Manifest - YAML configuration structure
// ----------------------------------------------------------------------------

export interface RecipeManifest {
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
    input: InputField[];

    /** Model requirements and defaults */
    model: ModelRequirements;

    /** Prompt templates */
    prompt: PromptTemplates;

    /** Output definition */
    output: OutputDefinition;

    /** Advanced options */
    advanced?: AdvancedOptions;
}

// ----------------------------------------------------------------------------
// Output Config (used by engine for node creation)
// ----------------------------------------------------------------------------

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
        type: NodeType | string;
        data: Partial<BaseNodeData>;
        position?: 'below' | 'right' | XYPosition;
        dockedTo?: string | '$prev';
        connectTo?: { sourceHandle: string; targetHandle: string };
        assetConfig?: Record<string, any>;
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
    /** Input fields schema (resolved from manifest) */
    inputSchema: FieldDefinition[];
    /** The manifest this was created from */
    manifest: RecipeManifest;
    /** Core execution logic */
    execute: RecipeExecutor;
}

// ----------------------------------------------------------------------------
// Conversion Utilities
// ----------------------------------------------------------------------------

/**
 * Convert InputField to FieldDefinition (for runtime use)
 */
export function inputFieldToDefinition(field: InputField): FieldDefinition {
    return {
        id: field.key,
        key: field.key,
        label: field.label,
        type: field.type,
        widget: field.widget as import('./widgets').WidgetType | undefined,
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

