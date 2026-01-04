/**
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                   🍳 Synnia Recipe System                       │
 * │         YAML/Package → RecipeManifest → RecipeDefinition        │
 * ├─────────────────────────────────────────────────────────────────┤
 * │                                                                 │
 * │  Recipe Package Structure:                                      │
 * │  ──────────────────────────                                     │
 * │  recipe-name/                                                   │
 * │  ├── manifest.yaml         # Meta + model + executor            │
 * │  ├── input.schema.json     # Input FieldDefinition[]            │
 * │  ├── output.config.yaml    # Output configuration               │
 * │  ├── output.schema.json    # Output FieldDefinition[]           │
 * │  ├── prompts/                                                   │
 * │  │   ├── system.md         # System prompt                      │
 * │  │   └── user.md           # User prompt template               │
 * │  └── README.md             # Documentation                      │
 * │                                                                 │
 * │  Type Flow:                                                     │
 * │  ──────────                                                     │
 * │  YAML/JSON → Loader → RecipeDefinition → GraphEngine            │
 * │                                                                 │
 * └─────────────────────────────────────────────────────────────────┘
 */

import { LucideIcon } from 'lucide-react';
import { FieldDefinition } from './assets';
import { BaseNodeData, SynniaNode } from './project';
import { GraphEngine } from '@core/engine/GraphEngine';
import { XYPosition } from '@xyflow/react';
import type { ModelCapability } from '@features/models/types';

// ==========================================
// 🎯 Model Requirements
// ==========================================

export interface ModelRequirements {
    category: 'llm' | 'image-generation' | 'video-generation';
    capabilities?: ModelCapability[];
    defaultParams?: {
        temperature?: number;
        maxTokens?: number;
        jsonMode?: boolean;
    };
}

// ==========================================
// 📝 Prompt Templates
// ==========================================

export interface PromptTemplates {
    system: string;
    user: string;
}

// ==========================================
// 📤 Output Definition
// ==========================================

/**
 * Output configuration.
 * All nodes expect JSON output except 'text' which accepts raw string.
 */
export interface OutputDefinition {
    node: string;  // form | selector | gallery | table | text
    title?: string;
    collapsed?: boolean;
    schema?: FieldDefinition[];  // Output schema (for form/selector/table)
    extra?: Record<string, any>; // Node-specific config → asset.config.extra
}

// ==========================================
// ⚙️ Advanced Options
// ==========================================

export interface AdvancedOptions {
    streaming?: boolean;
    multiTurn?: boolean;
    retryOnError?: boolean;
}

// ==========================================
// 📋 Executor Config
// ==========================================

export interface ExecutorConfig {
    type: string;
    [key: string]: any;
}

// ==========================================
// 📦 Recipe Manifest (Package manifest.yaml)
// ==========================================

export interface RecipeManifest {
    version: 2;

    // --- Identity ---
    id: string;
    name: string;
    description?: string;
    category?: string;
    icon?: string;

    // --- Market (Optional) ---
    author?: string;
    license?: string;
    tags?: string[];
    cover?: string;

    // --- Model ---
    model: ModelRequirements;

    // --- Executor ---
    executor?: ExecutorConfig;

    // --- Prompt (inline or file reference) ---
    prompt?: PromptTemplates;

    // --- Input (inline or from input.schema.json) ---
    input?: FieldDefinition[];

    // --- Output ---
    output: OutputDefinition;

    // --- Advanced ---
    advanced?: AdvancedOptions;
}

// ==========================================
// ⚡ Execution Context & Result
// ==========================================

export interface ExecutionContext {
    inputs: Record<string, any>;
    nodeId: string;
    engine: GraphEngine;
    node: SynniaNode;
    manifest: RecipeManifest;
    chatContext?: import('@/features/recipes/types').ChatMessage[];
    modelConfig?: import('@/features/recipes/types').ModelConfig;
}

export interface ExecutionResult {
    success: boolean;
    data?: any;
    error?: string;
    createNodes?: {
        type: string;
        data: Partial<BaseNodeData>;
        position?: 'below' | 'right' | XYPosition;
        dockedTo?: string | '$prev';
        config?: {
            schema?: FieldDefinition[];
            extra?: Record<string, any>;
        };
    }[];
}

// ==========================================
// 🏭 Recipe Definition (Runtime)
// ==========================================

export type RecipeExecutor = (ctx: ExecutionContext) => Promise<ExecutionResult>;

export interface RecipeDefinition {
    id: string;
    name: string;
    description?: string;
    icon?: LucideIcon;
    category?: string;
    inputSchema: FieldDefinition[];
    outputSchema?: FieldDefinition[];
    manifest: RecipeManifest;
    execute: RecipeExecutor;
}
