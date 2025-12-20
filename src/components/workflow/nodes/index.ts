import { NodeType } from '@/types/project';
import { NodeConfig, NodeCategory } from '@/types/node-config';
import { nodeRegistry } from '@/lib/nodes/NodeRegistry';
import { behaviorRegistry } from '@/lib/engine/BehaviorRegistry';
import { portRegistry } from '@/lib/engine/ports';
import { getAllRecipes } from '@/lib/recipes';
import { RecipeNode } from './RecipeNode';
import { RecipeNodeInspector } from './RecipeNode/Inspector';
import { FormAssetContent } from '@/types/assets';
import { FileText } from 'lucide-react';
import { getWidgetInputHandles } from '@/components/workflow/widgets';

// Import node definitions
import { definition as selectorDef } from './SelectorNode';
import { definition as tableDef } from './TableNode';
import { definition as galleryDef } from './GalleryNode';
import { definition as jsonDef } from './JSONNode';
import { definition as textDef } from './TextNode';
import { definition as imageDef } from './ImageNode';
import { definition as queueDef } from './QueueNode';

// ============================================================================
// Register Static Nodes
// ============================================================================

const staticDefinitions = [
    selectorDef,
    tableDef,
    galleryDef,
    jsonDef,
    textDef,
    imageDef,
    queueDef,
];

for (const def of staticDefinitions) {
    // Register to NodeRegistry
    nodeRegistry.register(def);

    // Register behavior (still needed for engine compatibility)
    if (def.behavior) {
        behaviorRegistry.register(def.type, def.behavior);
    }

    // Register ports (still needed for engine compatibility)
    if (def.ports) {
        portRegistry.register(def.type, def.ports);
    }
}

// ============================================================================
// Recipe-as-Node: Each Recipe appears as a separate node type
// ============================================================================

const recipes = getAllRecipes();

for (const recipe of recipes) {
    const virtualType = `recipe:${recipe.id}`;

    // Register to NodeRegistry
    nodeRegistry.register({
        type: virtualType,
        component: RecipeNode,
        inspector: RecipeNodeInspector,
        config: {
            type: virtualType as any,
            title: recipe.name,
            category: (recipe.category || 'Recipe') as NodeCategory,
            icon: recipe.icon || FileText,
            description: recipe.description || '',
            defaultData: {
                recipeId: recipe.id,
                inputs: {}
            }
        },
    });

    // Register dynamic ports for recipe nodes
    portRegistry.register(virtualType, {
        dynamic: (node, asset) => {
            const ports: any[] = [
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

            const values = (asset?.content as FormAssetContent)?.values || {};

            for (const field of recipe.inputSchema) {
                const conn = field.connection;
                const fieldKey = field.key;
                const fieldValue = values[fieldKey];

                const hasOutput = conn?.output === true ||
                    (typeof conn?.output === 'object' && conn.output.enabled);

                if (hasOutput) {
                    const handleId = typeof conn?.output === 'object' && conn.output.handleId
                        ? conn.output.handleId
                        : `field:${field.key}`;

                    const isDisabled = field.disabled === true;

                    ports.push({
                        id: handleId,
                        direction: 'output',
                        dataType: 'json',
                        label: field.label || field.key,
                        resolver: (n: any, a: any) => {
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

                if (field.widget) {
                    const extraHandles = getWidgetInputHandles(field.widget, fieldValue);
                    for (const h of extraHandles) {
                        const extraHandleId = `${fieldKey}:${h.id}`;
                        ports.push({
                            id: extraHandleId,
                            direction: 'input',
                            dataType: h.dataType || 'json',
                            label: h.label || h.id,
                        });
                    }
                }
            }

            return ports;
        }
    });
}

// ============================================================================
// Exports - Delegated from NodeRegistry
// ============================================================================

export const nodeTypes = nodeRegistry.getNodeTypes();
export const inspectorTypes = nodeRegistry.getInspectorTypes();
export const nodesConfig = nodeRegistry.getAllConfigs();

// Re-export nodeRegistry for direct access
export { nodeRegistry };
