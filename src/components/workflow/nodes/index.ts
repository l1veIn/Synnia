import { NodeType } from '@/types/project';
import { NodeConfig, NodeCategory } from '@/types/node-config';
import { behaviorRegistry } from '@/lib/engine/BehaviorRegistry';
import { getAllRecipes } from '@/lib/recipes';
import { RecipeNode } from './RecipeNode';
import { RecipeNodeInspector } from './RecipeNode/Inspector';
import { portRegistry } from '@/lib/engine/ports';
import { FormAssetContent } from '@/types/assets';
import { FileText } from 'lucide-react';

// Auto-import all node modules
const modules = import.meta.glob('./**/*.tsx', { eager: true });

export const nodeTypes: Record<string, any> = {};

export const inspectorTypes: Record<string, any> = {};

export const nodesConfig: Record<string, NodeConfig> = {};



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

        // Note: Ports are now registered via portRegistry.register() in each node file
    }
}

// ============================================================================
// Recipe-as-Node: Each Recipe appears as a separate node type in menus
// ============================================================================

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

    // Register dynamic ports for this recipe type
    portRegistry.register(virtualType, {
        dynamic: (node, asset) => {
            const ports: any[] = [
                // Base reference output (same as RECIPE type)
                {
                    id: 'reference',
                    direction: 'output',
                    dataType: 'json',
                    label: 'Reference Output',
                    resolver: (n: any, a: any) => {
                        if (a?.content && typeof a.content === 'object') {
                            const content = a.content as any;
                            if (content.values) {
                                return {
                                    type: 'json',
                                    value: content.values,
                                    meta: { nodeId: n.id, portId: 'reference' }
                                };
                            }
                        }
                        return { type: 'json', value: {}, meta: { nodeId: n.id, portId: 'reference' } };
                    }
                }
            ];

            // Add field-level output ports based on recipe schema
            for (const field of recipe.inputSchema) {
                const conn = field.connection;
                const hasOutput = conn?.output === true ||
                    (typeof conn?.output === 'object' && conn.output.enabled);

                if (hasOutput) {
                    const handleId = typeof conn?.output === 'object' && conn.output.handleId
                        ? conn.output.handleId
                        : `field:${field.key}`;

                    const isDisabled = field.disabled === true;
                    const fieldKey = field.key;

                    ports.push({
                        id: handleId,
                        direction: 'output',
                        dataType: 'json',
                        label: field.label || field.key,
                        resolver: (n: any, a: any) => {
                            // For disabled fields: read from executionResult
                            if (isDisabled) {
                                const execResult = n.data?.executionResult;
                                if (execResult && typeof execResult === 'object') {
                                    const value = execResult[fieldKey];
                                    if (value !== undefined) {
                                        return { type: 'json', value, meta: { nodeId: n.id, portId: handleId } };
                                    }
                                }
                                return null;
                            }

                            // For normal fields: read from asset.content.values
                            if (a?.content && typeof a.content === 'object') {
                                const content = a.content as FormAssetContent;
                                const value = content.values?.[fieldKey];
                                if (value !== undefined) {
                                    return { type: 'json', value, meta: { nodeId: n.id, portId: handleId } };
                                }
                            }
                            return null;
                        }
                    });
                }
            }

            return ports;
        }
    });
}
