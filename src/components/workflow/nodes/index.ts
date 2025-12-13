import { NodeType } from '@/types/project';
import { NodeConfig, NodeOutputConfig, NodeCategory } from '@/types/node-config';
import { FallbackNode } from './FallbackNode';
import { behaviorRegistry } from '@/lib/engine/BehaviorRegistry';
import { getAllRecipes } from '@/lib/recipes';
import { RecipeNode } from './RecipeNode';
import { RecipeNodeInspector } from './RecipeNode/Inspector';

// Auto-import all node modules
const modules = import.meta.glob('./**/*.tsx', { eager: true });

export const nodeTypes: Record<string, any> = {
    // Fallbacks / Legacy
    [NodeType.ASSET]: FallbackNode,
    [NodeType.NOTE]: FallbackNode,
    [NodeType.COLLECTION]: FallbackNode,
};

export const inspectorTypes: Record<string, any> = {};

export const nodesConfig: Record<string, NodeConfig> = {};

// NEW: Output resolvers registry
export const nodeOutputs: Record<string, NodeOutputConfig> = {};

// Legacy Configs (hidden)
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
    }
}

// ============================================================================
// Recipe-as-Node: Each Recipe appears as a separate node type in menus
// ============================================================================

import { outputs as recipeBaseOutputs } from './RecipeNode';
import { FormAssetContent } from '@/types/assets';

const recipes = getAllRecipes();

for (const recipe of recipes) {
    // Virtual node type: use recipe id as type key (e.g., "math.divide")
    const virtualType = `recipe:${recipe.id}`;

    // All recipes use the RecipeNode component
    nodeTypes[virtualType] = RecipeNode;
    inspectorTypes[virtualType] = RecipeNodeInspector;

    // Config for menu display
    nodesConfig[virtualType] = {
        type: virtualType as any,
        title: recipe.name,
        category: (recipe.category || 'Recipe') as NodeCategory,
        icon: recipe.icon || FileText,
        description: recipe.description || '',
        // Extra data for node creation
        defaultData: {
            recipeId: recipe.id,
            inputs: {}
        }
    };

    // Generate output resolvers: base + field outputs
    const outputConfig: Record<string, any> = { ...recipeBaseOutputs };

    // Add field-level output resolvers
    for (const field of recipe.inputSchema) {
        const conn = field.connection;
        const hasOutput = conn?.output === true ||
            (typeof conn?.output === 'object' && conn.output.enabled);

        if (hasOutput) {
            const handleId = typeof conn?.output === 'object' && conn.output.handleId
                ? conn.output.handleId
                : `field:${field.key}`;

            const isDisabled = field.disabled === true;

            outputConfig[handleId] = (node: any, asset: any) => {
                // For disabled fields: read from executionResult (output of execute())
                if (isDisabled) {
                    const execResult = node.data?.executionResult;
                    if (execResult && typeof execResult === 'object') {
                        const value = execResult[field.key];
                        if (value !== undefined) {
                            return { type: 'json', value };
                        }
                    }
                    return null;
                }

                // For normal fields: read from asset.content.values
                if (asset?.content && typeof asset.content === 'object') {
                    const content = asset.content as FormAssetContent;
                    const value = content.values?.[field.key];
                    if (value !== undefined) {
                        return { type: 'json', value };
                    }
                }
                return null;
            };
        }
    }

    nodeOutputs[virtualType] = outputConfig;
}
