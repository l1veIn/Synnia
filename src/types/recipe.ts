import { LucideIcon } from 'lucide-react';
import { FieldDefinition } from './assets';
import { NodeType, BaseNodeData, SynniaNode } from './project';
import { GraphEngine } from '@/lib/engine/GraphEngine';
import { XYPosition } from '@xyflow/react';

// ============================================================================
// Recipe Definition System V2
// ============================================================================

/**
 * Execution context passed to recipe execute() method.
 * Provides resolved inputs and graph manipulation capabilities.
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
}

/**
 * Result returned by recipe execute() method.
 */
export interface ExecutionResult {
    /** Whether execution succeeded */
    success: boolean;
    /** Output data (arbitrary structure, validated by outputSchema if present) */
    data?: any;
    /** 
     * Optional: Request to create product nodes.
     * The recipe decides whether its output generates nodes.
     */
    createNodes?: {
        type: NodeType;
        data: Partial<BaseNodeData>;
        position?: 'below' | 'right' | XYPosition;
    }[];
    /** Error message if success is false */
    error?: string;
}

/**
 * Output schema for validation (not for determining output form).
 */
export interface OutputSchema {
    /** Expected output type */
    type: 'json' | 'text' | 'image' | 'void';
    /** JSON Schema for structured validation (optional) */
    jsonSchema?: object;
    /** Human-readable description */
    description?: string;
}

/**
 * Core Recipe Definition.
 * Each recipe = one virtual node type in the system.
 */
export interface RecipeDefinition {
    /** Unique recipe ID (e.g., "math.divide", "http.request") */
    id: string;
    /** Display name */
    name: string;
    /** Description for tooltips/help */
    description?: string;
    /** Lucide icon for menu/header */
    icon?: LucideIcon;
    /** Category for grouping in Add Node menu */
    category?: string;

    /** Input fields schema (reuses existing FieldDefinition) */
    inputSchema: FieldDefinition[];
    /** Output validation schema (optional) */
    outputSchema?: OutputSchema;

    /** 
     * Core execution logic.
     * Receives context with resolved inputs, returns result.
     * Recipe decides whether to create product nodes via createNodes.
     */
    execute: (ctx: ExecutionContext) => Promise<ExecutionResult>;

    /** Mixin IDs to inherit from (future) */
    mixin?: string[];
    /** Custom node render component (optional, for complex UIs) */
    customComponent?: React.FC<any>;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Type-safe helper for defining recipes.
 */
export const defineRecipe = (def: RecipeDefinition): RecipeDefinition => def;
