import { getRecipe } from '@features/recipes';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { invoke } from '@tauri-apps/api/core';
import { useWorkflowStore } from '@/store/workflowStore';
import { graphEngine } from '@core/engine/GraphEngine';
import { SmartNodeSpec } from '@core/engine/GraphMutator';
import { ExecutionContext } from '@/types/recipe';
import { nodeRegistry } from '@core/registry/NodeRegistry';
import { getConnectedFieldValues } from '@/hooks/useInspector';
import { inferValueType, determineOutputAction } from '@features/executors/utils';
import { updateNodeExecutionUseCase } from '@/application/use-cases/update-node-execution';

// ============================================
// Execution Logging (TEP #001: Operational Layer)
// ============================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface ExecutionLogger {
    log: (level: LogLevel, message: string, data?: Record<string, unknown>) => Promise<void>;
    complete: (status: 'success' | 'error', summary?: {
        tokenInput?: number;
        tokenOutput?: number;
        errorMessage?: string;
    }) => Promise<void>;
}

async function createExecutionLogger(nodeId: string, recipeId: string, modelId?: string): Promise<ExecutionLogger | null> {
    const projectRoot = useWorkflowStore.getState().projectRoot;
    if (!projectRoot) return null;

    const runId = crypto.randomUUID();
    const startedAt = Date.now();

    try {
        await invoke('create_execution_run', {
            projectPath: projectRoot,
            run: {
                id: runId,
                nodeId,
                recipeId,
                startedAt,
                status: 'running',
                modelId,
            }
        });
    } catch (e) {
        console.warn('[ExecutionLogger] Failed to create run:', e);
        return null;
    }

    return {
        log: async (level: LogLevel, message: string, data?: Record<string, unknown>) => {
            try {
                await invoke('append_log_entry', {
                    projectPath: projectRoot,
                    entry: {
                        runId,
                        timestamp: Date.now(),
                        level,
                        message,
                        dataJson: data ? JSON.stringify(data) : undefined,
                    }
                });
            } catch (e) {
                console.warn('[ExecutionLogger] Failed to append entry:', e);
            }
        },
        complete: async (status: 'success' | 'error', summary?: {
            tokenInput?: number;
            tokenOutput?: number;
            errorMessage?: string;
        }) => {
            try {
                await invoke('update_execution_run', {
                    projectPath: projectRoot,
                    runId,
                    updates: {
                        completedAt: Date.now(),
                        status,
                        durationMs: Date.now() - startedAt,
                        tokenInput: summary?.tokenInput,
                        tokenOutput: summary?.tokenOutput,
                        errorMessage: summary?.errorMessage,
                    }
                });
            } catch (e) {
                console.warn('[ExecutionLogger] Failed to update run:', e);
            }
        }
    };
}

// ============================================
// Chat Message Saving (TEP #001: Operational Layer)
// ============================================

type ContentType = 'text' | 'json';

/**
 * Save a chat message to the operational layer.
 * Called during recipe execution to persist user inputs and AI responses.
 */
async function saveChatMessage(
    nodeId: string,
    role: 'user' | 'assistant',
    content: any,
    contentType: ContentType
): Promise<void> {
    const projectRoot = useWorkflowStore.getState().projectRoot;
    if (!projectRoot) return;

    // Serialize content if it's an object
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);

    try {
        await invoke('add_chat_message', {
            projectPath: projectRoot,
            message: {
                id: crypto.randomUUID(),
                nodeId,
                role,
                content: contentStr,
                contentType,
                timestamp: Date.now(),
            }
        });
    } catch (e) {
        console.warn('[ChatMessage] Failed to save:', e);
    }
}

/**
 * Get merged input values for a node: own asset values + connected field values.
 * This replaces the old refreshConnectedInputs pattern that relied on onConnect.
 */
function getMergedInputValues(nodeId: string): Record<string, any> {
    const { nodes, edges, assets } = useWorkflowStore.getState();
    const node = nodes.find(n => n.id === nodeId);
    if (!node || !node.data.assetId) return {};

    // Get own asset values
    const asset = assets[node.data.assetId];
    const ownValue = (asset?.value && typeof asset.value === 'object')
        ? asset.value as Record<string, any>
        : {};

    // Get connected field values (dynamically resolved from source nodes)
    const connectedValue = getConnectedFieldValues(nodeId, nodes, edges, assets);

    // Merge: connected values override own values
    return { ...ownValue, ...connectedValue };
}

function updateExecutionState(nodeId: string, state: 'idle' | 'running' | 'paused' | 'error' | 'success' | 'stale', errorMessage?: string) {
    const store = useWorkflowStore.getState();
    const updated = updateNodeExecutionUseCase(nodeId, state, errorMessage, {
        getNodes: () => store.nodes,
        getAssets: () => store.assets,
    });
    if (!updated) return;
    graphEngine.setNodes(store.nodes.map(n => n.id === nodeId ? updated : n));
}

/**
 * Hook to run a Recipe Definition.
 */
export function useRunRecipe() {
    const runRecipe = useCallback(async (nodeId: string, recipeId: string) => {
        const store = useWorkflowStore.getState();
        const node = store.nodes.find(n => n.id === nodeId);

        if (!node) {
            toast.error('Node not found');
            return;
        }

        const recipe = getRecipe(recipeId);
        if (!recipe) {
            toast.error(`Recipe not found: ${recipeId}`);
            return;
        }

        // Set Node State to Running
        updateExecutionState(nodeId, 'running');
        graphEngine.updateNode(nodeId, {
            data: { executionResult: undefined }
        });

        try {
            // --- Create Execution Logger (TEP #001: Operational Layer) ---
            const modelId = (store.assets[node.data.assetId as string]?.config as any)?.extra?.modelConfig?.modelId;
            const logger = await createExecutionLogger(nodeId, recipeId, modelId);
            await logger?.log('info', 'Starting recipe execution', { recipeId, nodeId });

            // --- Get Merged Input Values ---
            // Combines own asset values + connected field values (dynamically resolved)
            const staticValues = getMergedInputValues(nodeId);

            // Apply default values from schema
            const defaultValues: Record<string, any> = {};
            for (const field of recipe.inputSchema) {
                if (field.defaultValue !== undefined) {
                    defaultValues[field.key] = field.defaultValue;
                }
            }

            // Merge: defaults < static (static now includes connected values)
            const effectiveValues = { ...defaultValues, ...staticValues };

            // --- Validation ---
            for (const field of recipe.inputSchema) {
                const val = effectiveValues[field.key];

                if (field.required && (val === undefined || val === null || val === '')) {
                    throw new Error(`Missing required input: ${field.label || field.key}`);
                }

                // Validate object type has schema fields
                if (field.type === 'object' && field.schema && val) {
                    if (typeof val !== 'object') {
                        throw new Error(`Field '${field.key}' expects an object, got ${typeof val}`);
                    }
                    const requiredFields = field.schema.filter(f => f.required);
                    const missingKeys = requiredFields.filter(f => !(f.key in val)).map(f => f.key);
                    if (missingKeys.length > 0) {
                        throw new Error(`Field '${field.key}' missing keys: ${missingKeys.join(', ')}`);
                    }
                }
            }


            // --- Build Context ---
            const assetConfig = node.data.assetId
                ? store.assets[node.data.assetId as string]?.config
                : undefined;
            const recipeConfig = assetConfig as any;

            const ctx: ExecutionContext = {
                inputs: effectiveValues,
                nodeId,
                node,
                asset: node.data.assetId ? store.assets[node.data.assetId as string] : undefined,
                engine: graphEngine,
                manifest: recipe.manifest,
                chatContext: undefined, // Now handled by useChatContext in operational layer
                modelConfig: recipeConfig?.extra?.modelConfig,
            };

            await logger?.log('info', 'Executing recipe', {
                inputCount: Object.keys(effectiveValues).length,
                hasModelConfig: !!recipeConfig?.extra?.modelConfig,
            });

            // --- Save User Message (inputs as JSON) ---
            await saveChatMessage(nodeId, 'user', effectiveValues, 'json');

            // --- Execute ---
            const result = await recipe.execute(ctx);

            if (!result.success) {
                await logger?.complete('error', { errorMessage: result.error });
                throw new Error(result.error || 'Execution failed');
            }

            await logger?.log('info', 'Recipe completed successfully');

            // --- Save Assistant Message (result data) ---
            if (result.data !== undefined) {
                const contentType = typeof result.data === 'object' ? 'json' : 'text';
                await saveChatMessage(nodeId, 'assistant', result.data, contentType);
            }

            // --- Store Result in Node Data ---
            graphEngine.updateNode(nodeId, {
                data: { executionResult: result.data }
            });

            // --- Build SmartNodeSpecs from output config ---
            const outputConfig = (recipe.manifest as any).output || (recipe.manifest as any).executor?.output;

            if (outputConfig && result.data) {
                const freshStore2 = useWorkflowStore.getState();
                const freshNode2 = freshStore2.nodes.find(n => n.id === nodeId);
                if (!freshNode2) return;

                // Determine value type (explicit or inferred)
                const valueType = inferValueType(outputConfig.node || 'form', outputConfig.valueType);

                // Find existing product node
                const existingOutputEdge = freshStore2.edges.find(e =>
                    e.source === nodeId &&
                    e.sourceHandle === 'product' &&
                    e.data?.edgeType === 'output'
                );

                const existingProductNode = existingOutputEdge
                    ? freshStore2.nodes.find(n => n.id === existingOutputEdge.target)
                    : null;

                const existingAsset = existingProductNode
                    ? freshStore2.assets[existingProductNode.data.assetId as string]
                    : null;

                // Determine action based on valueType and existing asset
                const action = determineOutputAction(
                    valueType,
                    existingAsset ? { id: existingAsset.id, config: existingAsset.config } : null,
                    result.data
                );

                // Normalize data
                const dataItems = Array.isArray(result.data) ? result.data : [result.data];

                // --- Execute Action ---
                if (action.type === 'update' && existingAsset) {
                    // Record mode: direct update
                    graphEngine.assets.update(action.assetId, dataItems.length === 1 ? dataItems[0] : dataItems);
                    return;
                }

                if (action.type === 'merge' && existingAsset && existingProductNode) {
                    // Array mode: merge items
                    const nodeDef = nodeRegistry.getDefinition(existingProductNode.type);
                    if (nodeDef?.hooks?.getItems && nodeDef?.hooks?.mergeItems) {
                        const existingItems = nodeDef.hooks.getItems(existingAsset);
                        const mergedItems = nodeDef.hooks.mergeItems(existingItems, dataItems);
                        graphEngine.assets.update(action.assetId, mergedItems);
                    } else {
                        // Fallback: concat arrays
                        const existingValue = existingAsset.value;
                        const merged = Array.isArray(existingValue)
                            ? [...existingValue, ...dataItems]
                            : dataItems;
                        graphEngine.assets.update(action.assetId, merged);
                    }
                    return;
                }

                // --- CREATE MODE ---
                const isArray = valueType === 'array';

                // Resolve title template
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
                    // Array: single node with all data
                    specs = [{
                        value: dataItems,
                        schema: outputConfig.schema,
                        node: outputConfig.node,
                        name: resolveTitle(0, null),
                        collapsed: outputConfig.collapsed ?? false,
                        anchor: nodeId,
                        offset: 'below',
                        outputEdgeFrom: nodeId,
                    }];
                } else {
                    // Record: one node per item
                    specs = dataItems.map((item, i) => ({
                        value: item,
                        schema: outputConfig.schema,
                        node: outputConfig.node,
                        name: resolveTitle(i, item),
                        collapsed: outputConfig.collapsed ?? true,
                        anchor: i === 0 ? nodeId : undefined,
                        offset: i === 0 ? 'below' as const : undefined,
                        outputEdgeFrom: i === 0 ? nodeId : undefined,
                    }));
                }

                // Create nodes
                graphEngine.mutator.createSmartBatch(specs);
            }

            // --- Complete Logger ---
            await logger?.complete('success', {
                tokenInput: (result as any).usage?.input,
                tokenOutput: (result as any).usage?.output,
            });

            toast.success(`${recipe.name} completed`);
            updateExecutionState(nodeId, 'success');
            setTimeout(() => updateExecutionState(nodeId, 'idle'), 2000);

        } catch (e: any) {
            console.error('[RunRecipe] Error:', e);
            toast.error(e.message || String(e));
            updateExecutionState(nodeId, 'error', e.message || String(e));
        }
    }, []);

    /**
     * Run a Recipe with chat context (multi-turn conversation).
     * Called from ChatTab when user sends a follow-up message.
     */
    const runRecipeWithChat = useCallback(async (
        nodeId: string,
        recipeId: string,
        userMessage: string
    ) => {
        const store = useWorkflowStore.getState();
        const node = store.nodes.find(n => n.id === nodeId);

        if (!node) {
            toast.error('Node not found');
            return;
        }

        const recipe = getRecipe(recipeId);
        if (!recipe) {
            toast.error(`Recipe not found: ${recipeId}`);
            return;
        }

        // Set Node State to Running
        updateExecutionState(nodeId, 'running');

        try {
            // --- Create Execution Logger ---
            const modelId = (store.assets[node.data.assetId as string]?.config as any)?.extra?.modelConfig?.modelId;
            const logger = await createExecutionLogger(nodeId, recipeId, modelId);
            await logger?.log('info', 'Starting multi-turn execution', { recipeId, nodeId });

            // --- Save User Message ---
            await saveChatMessage(nodeId, 'user', userMessage, 'text');

            // --- Load Chat History ---
            const projectRoot = store.projectRoot;
            let chatMessages: { role: string; content: string }[] = [];
            if (projectRoot) {
                try {
                    const messages = await invoke<any[]>('get_chat_messages', {
                        projectPath: projectRoot,
                        nodeId,
                    });
                    // Convert to simple format for LLM
                    chatMessages = messages.map(m => ({
                        role: m.role,
                        content: m.content,
                    }));
                } catch (e) {
                    console.warn('[RunRecipeWithChat] Failed to load chat history:', e);
                }
            }

            // --- Get Input Values (from original form) ---
            const staticValues = getMergedInputValues(nodeId);

            // --- Build Context with Chat History ---
            const assetConfig = node.data.assetId
                ? store.assets[node.data.assetId as string]?.config
                : undefined;
            const recipeConfig = assetConfig as any;

            const ctx: ExecutionContext = {
                inputs: staticValues,
                nodeId,
                node,
                asset: node.data.assetId ? store.assets[node.data.assetId as string] : undefined,
                engine: graphEngine,
                manifest: recipe.manifest,
                chatContext: chatMessages as any, // Pass chat history
                modelConfig: recipeConfig?.extra?.modelConfig,
            };

            await logger?.log('info', 'Executing with chat context', {
                messageCount: chatMessages.length,
            });

            // --- Execute ---
            const result = await recipe.execute(ctx);

            if (!result.success) {
                await logger?.complete('error', { errorMessage: result.error });
                throw new Error(result.error || 'Execution failed');
            }

            await logger?.log('info', 'Recipe completed successfully');

            // --- Save Assistant Message ---
            if (result.data !== undefined) {
                const contentType = typeof result.data === 'object' ? 'json' : 'text';
                await saveChatMessage(nodeId, 'assistant', result.data, contentType);
            }

            // --- Update Existing Product Node (instead of creating new) ---
            const freshStore = useWorkflowStore.getState();
            // Find product edge: source is this node, sourceHandle is 'product'
            const existingOutputEdge = freshStore.edges.find(e =>
                e.source === nodeId &&
                e.sourceHandle === 'product'
            );

            if (existingOutputEdge) {
                const existingProductNode = freshStore.nodes.find(n => n.id === existingOutputEdge.target);
                if (existingProductNode && existingProductNode.data.assetId) {
                    const existingAsset = freshStore.assets[existingProductNode.data.assetId as string];
                    if (existingAsset && result.data) {
                        graphEngine.assets.update(existingAsset.id, result.data);
                        await logger?.log('info', 'Updated existing product node', {
                            productNodeId: existingProductNode.id,
                            assetId: existingAsset.id
                        });
                    }
                }
            } else {
                await logger?.log('warn', 'No existing product node found, run recipe first to create one');
            }

            // --- Complete Logger ---
            await logger?.complete('success', {
                tokenInput: (result as any).usage?.input,
                tokenOutput: (result as any).usage?.output,
            });

            toast.success('Response generated');
            updateExecutionState(nodeId, 'success');
            setTimeout(() => updateExecutionState(nodeId, 'idle'), 2000);

        } catch (e: any) {
            console.error('[RunRecipeWithChat] Error:', e);
            toast.error(e.message || String(e));
            updateExecutionState(nodeId, 'error', e.message || String(e));
        }
    }, []);

    return { runRecipe, runRecipeWithChat };
}
