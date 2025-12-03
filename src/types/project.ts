// This file acts as the SINGLE SOURCE OF TRUTH for frontend types during "Detached Mode".
// It is temporarily decoupled from Rust bindings to accelerate UI/UX development.

// --- Core Types (Migrated from bindings/synnia.ts) ---

import { SynniaAsset } from './assets';

export type NodeStatus = "idle" | "processing" | "success" | "error" | "stale";

export type SynniaProject = { 
    version: string; 
    meta: ProjectMeta; 
    viewport: Viewport; 
    graph: Graph; 
    settings?: Record<string, any>; // Made optional for easier mocking
};

export type SynniaNode = { 
    id: string; 
    type: string; 
    position: Position; 
    width?: number | null; // Optional for cleaner creation
    height?: number | null; 
    
    // --- New Frontend-Only Fields ---
    parentId?: string;     // For Collection containment
    extent?: 'parent';     // React Flow constraint
    expandParent?: boolean;// React Flow option
    // --------------------------------
    
    data: AssetData; 
};

export type SynniaEdge = { 
    id: string; 
    source: string; 
    target: string; 
    sourceHandle?: string | null; 
    targetHandle?: string | null; 
    type?: string | null; 
    label?: string | null; 
    animated?: boolean | null; 
};

// Use the discriminated union as the primary type, but allow loose typing for legacy/mock compatibility if needed
export type AssetData = SynniaAsset; 

export type Provenance = { 
    recipeId: string; 
    generatedAt: number; 
    sources: Array<ProvenanceSource>; 
    paramsSnapshot: Record<string, any>; 
};

export type ProvenanceSource = { 
    nodeId: string; 
    nodeVersion: number; 
    nodeHash?: string | null; 
    slot?: string | null; 
};

export type AgentDefinition = { 
    id: string; 
    name: string; 
    description?: string | null; 
    systemPrompt: string; 
    inputSchema: string; 
    outputConfig?: string | null; 
    isSystem: boolean; 
};

export type ProjectMeta = { 
    id: string; 
    name: string; 
    createdAt: string; 
    updatedAt: string; 
    thumbnail?: string | null; 
    description?: string | null; 
    author?: string | null; 
};

export type Viewport = { 
    x: number; 
    y: number; 
    zoom: number; 
};

export type Graph = { 
    nodes: Array<SynniaNode>; 
    edges: Array<SynniaEdge>; 
};

export type Position = { 
    x: number; 
    y: number; 
};

// --- Manual Helper Types ---

export type AssetType = string; // Keep flexible string

// Helper for Properties
export interface AssetProperties {
    name: string;
    description?: string;
    tags?: string[];
    src?: string;
    content?: string;
    [key: string]: any;
}