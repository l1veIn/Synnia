/**
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                   🍳 Synnia Recipe System                       │
 * │         manifest.yaml → RecipeManifest → RecipeDefinition       │
 * ├─────────────────────────────────────────────────────────────────┤
 * │                                                                 │
 * │  Recipe = Single manifest.yaml with $ref for complex parts      │
 * │  ─────────────────────────────────────────────────────────      │
 * │  recipe-name/                                                   │
 * │  ├── manifest.yaml         # 唯一入口，包含全部配置              │
 * │  │   ├── executor.type     # 'agent' | 'http'                   │
 * │  │   ├── executor.model    # $ref or inline                     │
 * │  │   ├── executor.prompt   # $ref: ./prompts/*.md               │
 * │  │   ├── input.schema      # $ref: ./schemas/input.yaml         │
 * │  │   └── output.schema     # $ref: ./schemas/output.yaml        │
 * │  ├── prompts/system.md     # Referenced by $ref                 │
 * │  ├── prompts/user.md       # Referenced by $ref                 │
 * │  └── schemas/*.yaml        # Referenced by $ref                 │
 * │                                                                 │
 * │  Type Flow:                                                     │
 * │  ──────────                                                     │
 * │  manifest.yaml → Loader($ref) → RecipeDefinition → GraphEngine  │
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
 * Output value type - determines how output is handled:
 * - 'record': Single object → update existing or create one node
 * - 'array': Array of items → merge into collection or create new
 */
export type OutputValueType = 'record' | 'array';

/**
 * Output configuration.
 * All nodes expect JSON output except 'text' which accepts raw string.
 */
export interface OutputDefinition {
    node: string;  // form | selector | gallery | table | text
    valueType?: OutputValueType;  // Explicit: 'record' | 'array'. If omitted, inferred from node type.
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
// 🔧 Executor Configs (Discriminated Union)
// ==========================================

export interface AgentExecutorConfig {
    type: 'agent';
    model: ModelRequirements;
    prompt?: PromptTemplates;
}

export interface HttpExecutorConfig {
    type: 'http';
    endpoint: string;
    method?: 'GET' | 'POST';
    timeout?: number;
    headers?: Record<string, string>;
}

// Discriminated union - TypeScript auto-narrows based on `type`
export type ExecutorConfig = AgentExecutorConfig | HttpExecutorConfig;

// ==========================================
// 📦 Recipe Manifest (Package manifest.yaml)
// ==========================================

export interface RecipeManifest {
    version: 1;

    // --- Identity ---
    id: string;
    name: string;
    description?: string;
    category?: string;       // Pure UI grouping (e.g. "创意工具", "媒体生成")
    icon?: string;

    // --- Market (Optional) ---
    author?: string;
    license?: string;
    tags?: string[];
    cover?: string;           // Cover image for marketplace
    readme?: string;          // Detailed documentation (inline or $ref: ./README.md)

    // --- Executor (discriminated union) ---
    executor: ExecutorConfig;

    // --- Input (nested format preferred, flat array supported for legacy) ---
    // Preferred: input: { schema: FieldDefinition[] }
    // Legacy:    input: FieldDefinition[]
    input?: { schema: FieldDefinition[] } | FieldDefinition[];

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
    asset?: import('@/types/assets').Asset;  // Asset for prompt customization
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

// ==========================================
// 📂 File System Types (for Recipe Manager)
// ==========================================

export type RecipeEntry =
    | { type: 'folder'; name: string; path: string }
    | {
        type: 'recipe';
        id: string;
        path: string;
        name: string;
        description?: string;
        author?: string;
        icon?: string;
        cover?: string;
    };

export interface DirectoryListing {
    path: string;
    entries: RecipeEntry[];
}

export interface FileNode {
    name: string;
    path: string;
    is_dir: boolean;
    children?: FileNode[];
}
