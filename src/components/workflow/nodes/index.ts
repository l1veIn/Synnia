import { NodeType } from '@/types/project';
import { NodeConfig } from '@/types/node-config';
import { AssetNode } from './AssetNode'; 

// Auto-import all node modules
const modules = import.meta.glob('./**/*.tsx', { eager: true });

export const nodeTypes: Record<string, any> = {
    // Fallbacks / Legacy
    [NodeType.ASSET]: AssetNode,
    // NOTE/COLLECTION map to AssetNode by default in legacy setup
    [NodeType.NOTE]: AssetNode,
    [NodeType.COLLECTION]: AssetNode,
};

export const inspectorTypes: Record<string, any> = {};

export const nodesConfig: Record<string, NodeConfig> = {};

// Legacy Configs (Manual migration needed eventually)
import { FileText, StickyNote, Layers } from 'lucide-react';

nodesConfig[NodeType.ASSET] = { type: NodeType.ASSET, title: 'Asset', category: 'Asset', icon: FileText, description: 'Generic Asset' };
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
        
        // console.log(`[NodeRegistry] Auto-loaded node: ${type}`);
    }
}
