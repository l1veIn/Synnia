/**
 * RunRecipeUseCase
 *
 * Unified entry point for recipe execution.
 * Extracted from useRunRecipe hook to follow DDD architecture.
 *
 * Responsibilities:
 * 1. Input validation
 * 2. Execution state management
 * 3. Recipe execution via ExecutorService
 * 4. Output node creation
 * 5. Execution logging
 */

import type { SynniaNode, SynniaEdge } from '@/types/project';
import type { Asset, FieldDefinition } from '@/types/assets';
import type { ExecutionContext, RecipeDefinition } from '@/types/recipe';
import type { ExecutorService, GraphMutatorPort, ExecutionLoggerPort } from '@/application/ports';
import type { SmartNodeSpec } from '@core/engine/GraphMutator';
import { inferValueType, determineOutputAction } from '@features/executors/utils';
import { nodeRegistry } from '@core/registry/NodeRegistry';

// ============================================================================
// Types
// ============================================================================

export interface RunRecipeRequest {
    nodeId: string;
    recipe: RecipeDefinition;
}

export interface RunRecipeDeps {
    getNodes: () => SynniaNode[];
    getAssets: () => Record<string, Asset>;
    getEdges: () => SynniaEdge[];
    getProjectRoot: () => string | null;
    executor: ExecutorService;
    logger: ExecutionLoggerPort;
    graphMutator: GraphMutatorPort;
    getConnectedFieldValues: (
        nodeId: string,
        nodes: SynniaNode[],
        edges: SynniaEdge[],
        assets: Record<string, Asset>
    ) => Record<string, unknown>;
}

export interface RunRecipeResult {
    success: boolean;
    error?: string;
    outputNodeId?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get merged input values for a node: own asset values + connected field values.
 */
function getMergedInputValues(
    nodeId: string,
    nodes: SynniaNode[],
    edges: SynniaEdge[],
    assets: Record<string, Asset>,
    getConnectedFieldValues: RunRecipeDeps['getConnectedFieldValues']
): Record<string, unknown> {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || !node.data.assetId) return {};

    const asset = assets[node.data.assetId as string];
    const ownValue =
        asset?.value && typeof asset.value === 'object'
            ? (asset.value as Record<string, unknown>)
            : {};

    const connectedValue = getConnectedFieldValues(nodeId, nodes, edges, assets);

    return { ...ownValue, ...connectedValue };
}

/**
 * Apply default values from input schema
 */
function applyDefaultValues(
    inputSchema: FieldDefinition[],
    values: Record<string, unknown>
): Record<string, unknown> {
    const defaults: Record<string, unknown> = {};
    for (const field of inputSchema) {
        if (field.defaultValue !== undefined) {
            defaults[field.key] = field.defaultValue;
        }
    }
    return { ...defaults, ...values };
}

/**
 * Validate input values against schema
 */
function validateInputs(
    inputSchema: FieldDefinition[],
    values: Record<string, unknown>
): { valid: boolean; error?: string } {
    for (const field of inputSchema) {
        const val = values[field.key];

        // Required field validation
        if (field.required && (val === undefined || val === null || val === '')) {
            return {
                valid: false,
                error: `Missing required input: ${field.label || field.key}`,
            };
        }

        // Nested object validation
        if (field.type === 'object' && field.schema && val) {
            if (typeof val !== 'object') {
                return {
                    valid: false,
                    error: `Field '${field.key}' expects an object, got ${typeof val}`,
                };
            }
            const requiredFields = field.schema.filter(f => f.required);
            const missingKeys = requiredFields
                .filter(f => !(f.key in (val as Record<string, unknown>)))
                .map(f => f.key);
            if (missingKeys.length > 0) {
                return {
                    valid: false,
                    error: `Field '${field.key}' missing keys: ${missingKeys.join(', ')}`,
                };
            }
        }
    }

    return { valid: true };
}

/**
 * Update node execution state via graphMutator.
 * Uses data.state for compatibility with nodeProjection.ts
 */
function updateExecutionState(
    nodeId: string,
    state: 'idle' | 'running' | 'paused' | 'error' | 'success' | 'stale',
    errorMessage: string | undefined,
    graphMutator: GraphMutatorPort
): void {
    const stateUpdate: Record<string, unknown> = {
        state,
        stateUpdatedAt: Date.now(),
    };
    if (errorMessage !== undefined) {
        stateUpdate.errorMessage = errorMessage;
    }
    graphMutator.updateNode(nodeId, { data: stateUpdate });
}

// ============================================================================
// Main Use Case
// ============================================================================

export async function runRecipeUseCase(
    request: RunRecipeRequest,
    deps: RunRecipeDeps
): Promise<RunRecipeResult> {
    const { nodeId, recipe } = request;
    const {
        getNodes,
        getAssets,
        getEdges,
        getProjectRoot,
        executor,
        logger,
        graphMutator,
        getConnectedFieldValues,
    } = deps;

    const nodes = getNodes();
    const assets = getAssets();
    const edges = getEdges();

    const node = nodes.find(n => n.id === nodeId);
    if (!node) {
        return { success: false, error: 'Node not found' };
    }

    // --- Set Running State ---
    updateExecutionState(nodeId, 'running', undefined, graphMutator);
    graphMutator.updateNode(nodeId, { data: { executionResult: undefined } });

    // --- Create Logger ---
    const modelId =
        (assets[node.data.assetId as string]?.config as any)?.extra?.modelConfig?.modelId;
    const execLogger = await logger.create(nodeId, recipe.id, modelId);
    await execLogger?.log('info', 'Starting recipe execution', { recipeId: recipe.id, nodeId });

    try {
        // --- Get Merged Input Values ---
        const staticValues = getMergedInputValues(nodeId, nodes, edges, assets, getConnectedFieldValues);
        const effectiveValues = applyDefaultValues(recipe.inputSchema, staticValues);

        // --- Validate Inputs ---
        const validation = validateInputs(recipe.inputSchema, effectiveValues);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        // --- Build Context ---
        const assetConfig = node.data.assetId
            ? assets[node.data.assetId as string]?.config
            : undefined;
        const recipeConfig = assetConfig as any;

        const ctx: ExecutionContext = {
            inputs: effectiveValues,
            nodeId,
            node,
            asset: node.data.assetId ? assets[node.data.assetId as string] : undefined,
            engine: null as any, // Will be provided by adapter
            manifest: recipe.manifest,
            chatContext: undefined,
            modelConfig: recipeConfig?.extra?.modelConfig,
        };

        await execLogger?.log('info', 'Executing recipe', {
            inputCount: Object.keys(effectiveValues).length,
            hasModelConfig: !!recipeConfig?.extra?.modelConfig,
        });

        // --- Execute ---
        const result = await executor.execute(ctx);

        if (!result.success) {
            await execLogger?.complete('error', { errorMessage: result.error });
            throw new Error(result.error || 'Execution failed');
        }

        await execLogger?.log('info', 'Recipe completed successfully');

        // --- Store Result in Node Data ---
        graphMutator.updateNode(nodeId, { data: { executionResult: result.data } });

        // --- Handle Output Node Creation ---
        const outputNodeId = await handleOutputCreation(
            nodeId,
            result.data,
            recipe,
            getNodes,
            getEdges,
            getAssets,
            graphMutator
        );

        // --- Complete Logger ---
        await execLogger?.complete('success', {
            tokenInput: (result as any).usage?.input,
            tokenOutput: (result as any).usage?.output,
        });

        // --- Set Success State ---
        updateExecutionState(nodeId, 'success', undefined, graphMutator);

        return {
            success: true,
            outputNodeId,
        };
    } catch (e: any) {
        console.error('[RunRecipeUseCase] Error:', e);

        await execLogger?.complete('error', { errorMessage: e.message });
        updateExecutionState(nodeId, 'error', e.message, graphMutator);

        return {
            success: false,
            error: e.message || String(e),
        };
    }
}

// ============================================================================
// Output Handling
// ============================================================================

async function handleOutputCreation(
    nodeId: string,
    resultData: any,
    recipe: RecipeDefinition,
    getNodes: () => SynniaNode[],
    getEdges: () => SynniaEdge[],
    getAssets: () => Record<string, Asset>,
    graphMutator: GraphMutatorPort
): Promise<string | undefined> {
    const outputConfig = (recipe.manifest as any).output || (recipe.manifest as any).executor?.output;

    if (!outputConfig || !resultData) return undefined;

    const nodes = getNodes();
    const edges = getEdges();
    const assets = getAssets();

    const freshNode = nodes.find(n => n.id === nodeId);
    if (!freshNode) return undefined;

    // Determine value type
    const valueType = inferValueType(outputConfig.node || 'form', outputConfig.valueType);

    // Find existing product node
    const existingOutputEdge = edges.find(
        e =>
            e.source === nodeId &&
            e.sourceHandle === 'product' &&
            e.data?.edgeType === 'output'
    );

    const existingProductNode = existingOutputEdge
        ? nodes.find(n => n.id === existingOutputEdge.target)
        : null;

    const existingAsset = existingProductNode
        ? assets[existingProductNode.data.assetId as string]
        : null;

    // Determine action
    const action = determineOutputAction(
        valueType,
        existingAsset ? { id: existingAsset.id, config: existingAsset.config } : null,
        resultData
    );

    // Normalize data
    const dataItems = Array.isArray(resultData) ? resultData : [resultData];

    // --- Execute Action ---
    if (action.type === 'update' && existingAsset) {
        graphMutator.updateAsset(
            action.assetId,
            dataItems.length === 1 ? dataItems[0] : dataItems
        );
        return existingProductNode?.id;
    }

    if (action.type === 'merge' && existingAsset && existingProductNode) {
        const nodeDef = nodeRegistry.getDefinition(existingProductNode.type);
        if (nodeDef?.hooks?.getItems && nodeDef?.hooks?.mergeItems) {
            const existingItems = nodeDef.hooks.getItems(existingAsset);
            const mergedItems = nodeDef.hooks.mergeItems(existingItems, dataItems);
            graphMutator.updateAsset(action.assetId, mergedItems);
        } else {
            const existingValue = existingAsset.value;
            const merged = Array.isArray(existingValue)
                ? [...existingValue, ...dataItems]
                : dataItems;
            graphMutator.updateAsset(action.assetId, merged);
        }
        return existingProductNode.id;
    }

    // --- CREATE MODE ---
    const isArray = valueType === 'array';

    const resolveTitle = (index: number, item: any): string => {
        if (outputConfig.title) {
            return outputConfig.title
                .replace(/\{\{count\}\}/g, String(dataItems.length))
                .replace(/\{\{index\}\}/g, String(index + 1))
                .replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => item?.[k] ?? '');
        }
        return isArray ? `Result (${dataItems.length} items)` : `#${index + 1}`;
    };

    let specs: SmartNodeSpec[];

    if (isArray) {
        specs = [
            {
                value: dataItems,
                schema: outputConfig.schema,
                node: outputConfig.node,
                name: resolveTitle(0, null),
                collapsed: outputConfig.collapsed ?? false,
                anchor: nodeId,
                offset: 'below',
                outputEdgeFrom: nodeId,
            },
        ];
    } else {
        specs = dataItems.map((item, i) => ({
            value: item,
            schema: outputConfig.schema,
            node: outputConfig.node,
            name: resolveTitle(i, item),
            collapsed: outputConfig.collapsed ?? true,
            anchor: i === 0 ? nodeId : undefined,
            offset: i === 0 ? ('below' as const) : undefined,
            outputEdgeFrom: i === 0 ? nodeId : undefined,
        }));
    }

    graphMutator.createSmartBatch(specs);

    // Return first created node ID (conceptual, actual ID is generated by mutator)
    return undefined;
}
