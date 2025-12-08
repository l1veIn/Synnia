import { NodeType } from '@/types/project';
import { NodeConfig } from '@/types/node-config';
import { AssetNode } from './AssetNode'; 
import { GroupNode } from './GroupNode'; 
import { RackNode } from './RackNode';   

// Auto-import all node modules
const modules = import.meta.glob('./**/*.tsx', { eager: true });

export const nodeTypes: Record<string, any> = {
    // Fallbacks / Legacy
    [NodeType.ASSET]: AssetNode,
    [NodeType.GROUP]: GroupNode,
    [NodeType.RACK]: RackNode,
    // NOTE/COLLECTION map to AssetNode by default in legacy setup
    [NodeType.NOTE]: AssetNode,
    [NodeType.COLLECTION]: AssetNode,
};

export const inspectorTypes: Record<string, any> = {};

export const nodesConfig: Record<string, NodeConfig> = {};

// Legacy Configs (Manual migration needed eventually)
import { Box, Layers, FileText, StickyNote } from 'lucide-react';

nodesConfig[NodeType.ASSET] = { type: NodeType.ASSET, title: 'Asset', category: 'Asset', icon: FileText, description: 'Generic Asset' };
nodesConfig[NodeType.GROUP] = { type: NodeType.GROUP, title: 'Group', category: 'Container', icon: Box, defaultWidth: 400, defaultHeight: 300, hidden: true };
nodesConfig[NodeType.RACK] = { type: NodeType.RACK, title: 'Rack', category: 'Container', icon: Layers, defaultWidth: 300, defaultHeight: 400 };
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
