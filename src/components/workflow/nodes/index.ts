import { NodeType } from '@/types/project';
import { NodeConfig, NodeOutputConfig } from '@/types/node-config';
import { FallbackNode } from './FallbackNode';
import { behaviorRegistry } from '@/lib/engine/BehaviorRegistry';

// Auto-import all node modules
const modules = import.meta.glob('./**/*.tsx', { eager: true });

export const nodeTypes: Record<string, any> = {
    // Fallbacks / Legacy
    [NodeType.ASSET]: FallbackNode,
    // NOTE/COLLECTION map to FallbackNode by default
    [NodeType.NOTE]: FallbackNode,
    [NodeType.COLLECTION]: FallbackNode,
};

export const inspectorTypes: Record<string, any> = {};

export const nodesConfig: Record<string, NodeConfig> = {};

// NEW: Output resolvers registry
export const nodeOutputs: Record<string, NodeOutputConfig> = {};

// Legacy Configs (Manual migration needed eventually)
import { FileText, StickyNote, Layers } from 'lucide-react';

nodesConfig[NodeType.ASSET] = { type: NodeType.ASSET, title: 'Asset', category: 'Asset', icon: FileText, description: 'Generic Asset', hidden: true };
nodesConfig[NodeType.NOTE] = { type: NodeType.NOTE, title: 'Note', category: 'Utility', icon: StickyNote, hidden: true };
nodesConfig[NodeType.COLLECTION] = { type: NodeType.COLLECTION, title: 'Collection', category: 'Container', icon: Layers, hidden: true };


// Process Auto-Loaded Modules
for (const path in modules) {
    const mod = modules[path] as any;

    // Check if it's a valid Node Module (has config and Node export)
    if (mod.config && mod.Node) {
        const type = mod.config.type;

        // Register Canvas Node
        nodeTypes[type] = mod.Node;

        // Register Inspector (if exists)
        if (mod.Inspector) {
            inspectorTypes[type] = mod.Inspector;
        }

        // Register Metadata
        nodesConfig[type] = mod.config;

        // Register Behavior
        if (mod.behavior) {
            behaviorRegistry.register(type, mod.behavior);
        }

        // NEW: Register Output Resolvers
        if (mod.outputs) {
            nodeOutputs[type] = mod.outputs;
        }

        // console.log(`[NodeRegistry] Auto-loaded node: ${type}`);
    }
}

