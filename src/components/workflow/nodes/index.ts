import { nodeRegistry, NodeCategory } from '@core/registry/NodeRegistry';
import { behaviorRegistry } from '@core/engine/BehaviorRegistry';
import { portRegistry } from '@core/engine/ports';
import { getAllRecipes } from '@features/recipes';
import { RecipeNode } from './RecipeNode';
import { RecipeNodeInspector } from './RecipeNode/Inspector';
import { FileText } from 'lucide-react';
import { getWidgetInputHandles } from '@/components/workflow/widgets';
import { getSettings, getDefaultModel, isProviderConfigured } from '@/lib/settings';
import { modelRegistry } from '@features/models';
import type { ModelConfig } from '@/types/assets';

// Import node definitions directly to avoid circular dependency
import { definition as selectorDef } from './SelectorNode/definition';
import { definition as tableDef } from './TableNode/definition';
import { definition as galleryDef } from './GalleryNode/definition';
import { definition as formDef } from './FormNode/definition';
import { definition as textDef } from './TextNode/definition';
import { definition as imageDef } from './ImageNode/definition';
import { definition as queueDef } from './QueueNode/definition';
import { RecipeBehavior } from './RecipeNode/behavior';

// ============================================================================
// Register Static Nodes
// ============================================================================

const staticDefinitions = [
    selectorDef,
    tableDef,
    galleryDef,
    formDef,
    textDef,
    imageDef,
    queueDef,
];

for (const def of staticDefinitions) {
    nodeRegistry.register(def);
    if (def.behavior) {
        behaviorRegistry.register(def.type, def.behavior);
    }
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

    nodeRegistry.register({
        type: virtualType,
        component: RecipeNode,
        inspector: RecipeNodeInspector,
        meta: {
            title: recipe.name,
            icon: recipe.icon || FileText,
            category: (recipe.category || 'Recipe') as NodeCategory,
            description: recipe.description || '',
            hidden: true, // Recipe nodes are picked via recipe tree, not node picker
            style: { width: 280 },  // Fixed width for Recipe nodes
        },
        create: () => {
            // Extract default values from recipe input schema
            const defaultValues: Record<string, any> = {};
            if (recipe.inputSchema) {
                for (const field of recipe.inputSchema) {
                    if (field.defaultValue !== undefined) {
                        defaultValues[field.key] = field.defaultValue;
                    }
                }
            }

            // Initialize modelConfig with default model if available
            let modelConfig: ModelConfig | undefined;
            const settings = getSettings();
            if (settings) {
                // Get model category from recipe manifest, fallback to 'llm'
                const category = recipe.manifest.model.category;
                const defaultModelId = getDefaultModel(settings, category);
                if (defaultModelId) {
                    const model = modelRegistry.get(defaultModelId);
                    if (model) {
                        const providers = model.supportedProviders || [model.provider];
                        const availableProvider = providers.find(p =>
                            isProviderConfigured(settings, p as any)
                        );
                        if (availableProvider) {
                            modelConfig = {
                                modelId: defaultModelId,
                                provider: availableProvider,
                                params: {},
                            };
                        }
                    }
                }
            }

            return {
                asset: {
                    valueType: 'record' as const,
                    value: defaultValues,
                    config: {
                        recipeId: recipe.id,
                        schemaSnapshot: recipe.inputSchema,  // Freeze schema at creation time
                        modelConfig
                    } as any,
                },
            };
        },
    });

    // Register behavior for recipe nodes
    behaviorRegistry.register(virtualType, RecipeBehavior);

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
                        // V2 architecture: form values stored directly in asset.value
                        if (a?.value && typeof a.value === 'object') {
                            return {
                                type: 'json',
                                value: a.value,
                                meta: { nodeId: n.id, portId: 'reference' }
                            };
                        }
                        return { type: 'json', value: {}, meta: { nodeId: n.id, portId: 'reference' } };
                    }
                }
            ];

            // RecordAsset: values are directly in asset.value
            const values = (asset?.value && typeof asset.value === 'object')
                ? asset.value as Record<string, any>
                : {};

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

                            // RecordAsset: values are directly in asset.value
                            if (a?.value && typeof a.value === 'object') {
                                const value = (a.value as Record<string, any>)[fieldKey];
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
// Exports
// ============================================================================

export const nodeTypes = nodeRegistry.getNodeTypes();
export const inspectorTypes = nodeRegistry.getInspectorTypes();

export { nodeRegistry };
