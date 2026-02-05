import { nodeRegistry, NodeCategory } from '@/domain/registry/NodeRegistry';
import { portRegistry } from '@/presentation/engine/ports';
import { RecipeNode } from './RecipeNode';
import { RecipeNodeInspector } from './RecipeNode/Inspector';
import { FileText } from 'lucide-react';
import { getSettings, getDefaultModel, isProviderConfigured } from '@/lib/settings';
import { modelRegistry } from '@/infrastructure/models';
import type { ModelConfig } from '@/domain/recipe/types';
import type { RecipeManifest } from '@/domain/recipe/manifest';

// Import node definitions directly to avoid circular dependency
import { definition as selectorDef } from './SelectorNode/definition';
import { definition as tableDef } from './TableNode/definition';
import { definition as galleryDef } from './GalleryNode/definition';
import { definition as formDef } from './FormNode/definition';
import { definition as textDef } from './TextNode/definition';
import { definition as imageDef } from './ImageNode/definition';
// import { definition as queueDef } from './QueueNode/definition';
import { RecipeBehavior } from './RecipeNode/behavior';
import { useRecipeStore } from '@/store/recipeStore';
import { registerRecipe } from '@/application/recipe';
import * as LucideIcons from 'lucide-react';

// ============================================================================
// Register Static Nodes (auto-cascades behavior + ports)
// ============================================================================

const staticDefinitions = [
    selectorDef,
    tableDef,
    galleryDef,
    formDef,
    textDef,
    imageDef,
    // queueDef,
];

for (const def of staticDefinitions) {
    nodeRegistry.register(def);
}

// ============================================================================
// Dynamic Recipe Registration
// ============================================================================

/** Tracks registered recipe IDs to prevent duplicate registration */
const registeredRecipes = new Set<string>();

/** Loading promises to prevent duplicate loading */
const loadingPromises = new Map<string, Promise<void>>();

/**
 * Register a single recipe node from manifest.
 * This is the core logic extracted from the original loop.
 */
function registerRecipeNode(manifest: RecipeManifest): void {
    const recipeId = manifest.id;
    const virtualType = `recipe:${recipeId}`;

    // Already registered
    if (registeredRecipes.has(recipeId)) return;

    // Register recipe in the recipes feature (for getResolvedRecipe)
    const recipe = registerRecipe(manifest);

    // Get icon
    const icon = manifest.icon
        ? (LucideIcons as any)[manifest.icon] || FileText
        : FileText;

    nodeRegistry.register({
        type: virtualType,
        component: RecipeNode,
        inspector: RecipeNodeInspector,
        behavior: RecipeBehavior,
        meta: {
            title: manifest.name,
            icon,
            category: (manifest.category || 'Recipe') as NodeCategory,
            description: manifest.description || '',
            hidden: true,
            style: { width: 280 },
        },
        create: () => {
            // Extract default values from recipe input schema
            const defaultValues: Record<string, any> = {};
            const inputSchema = Array.isArray(recipe.inputSchema) ? recipe.inputSchema : [];

            for (const field of inputSchema) {
                if (field && field.defaultValue !== undefined) {
                    defaultValues[field.key] = field.defaultValue;
                }
            }

            // Initialize modelConfig with default model if available
            let modelConfig: ModelConfig | undefined;
            const settings = getSettings();
            const executor = manifest.executor;

            if (settings && executor.type === 'agent') {
                const category = executor.model.category;
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
                                params: executor.model.defaultParams || {},
                            };
                        }
                    }
                }
            }

            // Copy prompts from manifest for user customization
            const prompt = (executor.type === 'agent' && executor.prompt) ? {
                system: executor.prompt.system || '',
                user: executor.prompt.user || '',
            } : undefined;

            return {
                asset: {
                    valueType: 'record' as const,
                    value: defaultValues,
                    config: {
                        schema: inputSchema,
                        extra: {
                            recipeId,
                            modelConfig,
                            prompt,
                        },
                    },
                },
            };
        },
    });

    // Register dynamic ports
    portRegistry.register(virtualType, {
        dynamic: (node, asset) => {
            const ports: any[] = [
                {
                    id: 'reference',
                    direction: 'output',
                    dataType: 'json',
                    label: 'Reference Output',
                    resolver: (n: any, a: any) => {
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

            const values = (asset?.value && typeof asset.value === 'object')
                ? asset.value as Record<string, any>
                : {};

            const inputSchema = recipe.inputSchema || [];

            for (const field of inputSchema) {
                const conn = field.connection;
                const fieldKey = field.key;

                const hasOutput = conn === 'output' || conn === 'both';

                if (hasOutput) {
                    const handleId = `field:${field.key}`;

                    ports.push({
                        id: handleId,
                        direction: 'output',
                        dataType: 'json',
                        label: field.label || field.key,
                        resolver: (n: any, a: any) => {
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
            }

            return ports;
        }
    });

    registeredRecipes.add(recipeId);
    console.log(`[Nodes] Registered recipe: ${recipeId}`);
}

/**
 * Ensure a recipe node is registered (load manifest if needed).
 * Uses Promise caching to prevent duplicate loading.
 */
export async function ensureRecipeNodeRegistered(recipeId: string): Promise<void> {
    // Already registered
    if (registeredRecipes.has(recipeId)) return;

    // Already loading
    const existing = loadingPromises.get(recipeId);
    if (existing) return existing;

    // Start loading
    const promise = (async () => {
        try {
            const store = useRecipeStore.getState();
            const manifest = await store.loadManifest(recipeId);
            registerRecipeNode(manifest);
        } catch (error) {
            console.error(`[Nodes] Failed to register recipe ${recipeId}:`, error);
            throw error;
        } finally {
            loadingPromises.delete(recipeId);
        }
    })();

    loadingPromises.set(recipeId, promise);
    return promise;
}

/**
 * Batch register recipe nodes (for project loading).
 * Returns list of failed recipe IDs.
 */
export async function ensureRecipeNodesRegistered(recipeIds: string[]): Promise<string[]> {
    const uniqueIds = [...new Set(recipeIds)];
    const failed: string[] = [];

    await Promise.all(
        uniqueIds.map(async (id) => {
            try {
                await ensureRecipeNodeRegistered(id);
            } catch {
                failed.push(id);
            }
        })
    );

    return failed;
}

/**
 * Check if a recipe is registered.
 */
export function isRecipeRegistered(recipeId: string): boolean {
    return registeredRecipes.has(recipeId);
}

// ============================================================================
// Exports
// ============================================================================

// Dynamic getters - recalculated on each access to include newly registered nodes
export function getNodeTypes() {
    return nodeRegistry.getNodeTypes();
}

export function getInspectorTypes() {
    return nodeRegistry.getInspectorTypes();
}

// Backwards compatibility - but prefer using getNodeTypes() for dynamic updates
export const nodeTypes = nodeRegistry.getNodeTypes();
export const inspectorTypes = nodeRegistry.getInspectorTypes();

export { nodeRegistry };
