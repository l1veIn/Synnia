/**
 * useRunRecipe Hook (Refactored)
 *
 * UI coordination layer only - delegates to RunRecipeUseCase.
 * Responsibilities:
 * - Toast notifications
 * - Loading state
 * - Calling UseCase
 */

import { getRecipe } from '@features/recipes';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { invoke } from '@tauri-apps/api/core';
import { useWorkflowStore } from '@/store/workflowStore';
import { graphEngine } from '@core/engine/GraphEngine';
import { runRecipeUseCase, RunRecipeDeps } from '@/application/use-cases/run-recipe';
import { executorAdapter } from '@/application/adapters/ExecutorAdapter';
import { ExecutionLoggerAdapter } from '@/application/adapters/ExecutionLoggerAdapter';
import { graphMutatorAdapter } from '@/application/adapters/GraphMutatorAdapter';
import { getConnectedFieldValues } from '@/hooks/useInspector';

/**
 * Update node execution state using data.state field for nodeProjection compatibility
 */
function updateNodeState(
    nodeId: string,
    state: 'idle' | 'running' | 'paused' | 'error' | 'success' | 'stale',
    errorMessage?: string
): void {
    const update: Record<string, unknown> = {
        state,
        stateUpdatedAt: Date.now(),
    };
    if (errorMessage !== undefined) {
        update.errorMessage = errorMessage;
    }
    graphEngine.updateNode(nodeId, { data: update });
}

/**
 * Hook to run a Recipe Definition.
 */
export function useRunRecipe() {
    const runRecipe = useCallback(async (nodeId: string, recipeId: string) => {
        const recipe = getRecipe(recipeId);
        if (!recipe) {
            toast.error(`Recipe not found: ${recipeId}`);
            return;
        }

        // Build dependencies for UseCase
        const deps: RunRecipeDeps = {
            getNodes: () => useWorkflowStore.getState().nodes,
            getAssets: () => useWorkflowStore.getState().assets,
            getEdges: () => useWorkflowStore.getState().edges,
            getProjectRoot: () => useWorkflowStore.getState().projectRoot,
            executor: executorAdapter,
            logger: new ExecutionLoggerAdapter(() => useWorkflowStore.getState().projectRoot),
            graphMutator: graphMutatorAdapter,
            getConnectedFieldValues,
        };

        // Execute UseCase
        const result = await runRecipeUseCase({ nodeId, recipe }, deps);

        // Handle result
        if (result.success) {
            toast.success(`${recipe.name} completed`);
            // Reset to idle after delay (UseCase sets 'success' state)
            setTimeout(() => {
                updateNodeState(nodeId, 'idle');
            }, 2000);
        } else {
            toast.error(result.error || 'Execution failed');
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

        // Set Running State (using data.state for compatibility)
        updateNodeState(nodeId, 'running');

        try {
            // --- Create Execution Logger ---
            const projectRoot = store.projectRoot;
            const modelId = (store.assets[node.data.assetId as string]?.config as any)?.extra?.modelConfig?.modelId;
            const loggerAdapter = new ExecutionLoggerAdapter(() => projectRoot);
            const logger = await loggerAdapter.create(nodeId, recipeId, modelId);
            await logger?.log('info', 'Starting multi-turn execution', { recipeId, nodeId });

            // --- Save User Message ---
            await saveChatMessage(nodeId, 'user', userMessage, 'text');

            // --- Load Chat History ---
            let chatMessages: { role: string; content: string }[] = [];
            if (projectRoot) {
                try {
                    const messages = await invoke<any[]>('get_chat_messages', {
                        projectPath: projectRoot,
                        nodeId,
                    });
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

            const ctx = {
                inputs: staticValues,
                nodeId,
                node,
                asset: node.data.assetId ? store.assets[node.data.assetId as string] : undefined,
                engine: graphEngine,
                manifest: recipe.manifest,
                chatContext: chatMessages as any,
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

            // --- Update Existing Product Node ---
            const freshStore = useWorkflowStore.getState();
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
            updateNodeState(nodeId, 'success');
            setTimeout(() => {
                updateNodeState(nodeId, 'idle');
            }, 2000);

        } catch (e: any) {
            console.error('[RunRecipeWithChat] Error:', e);
            toast.error(e.message || String(e));
            updateNodeState(nodeId, 'error', e.message);
        }
    }, []);

    return { runRecipe, runRecipeWithChat };
}

// ============================================================================
// Helper Functions (kept for runRecipeWithChat compatibility)
// ============================================================================

type ContentType = 'text' | 'json';

async function saveChatMessage(
    nodeId: string,
    role: 'user' | 'assistant',
    content: any,
    contentType: ContentType
): Promise<void> {
    const projectRoot = useWorkflowStore.getState().projectRoot;
    if (!projectRoot) return;

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

function getMergedInputValues(nodeId: string): Record<string, any> {
    const { nodes, edges, assets } = useWorkflowStore.getState();
    const node = nodes.find(n => n.id === nodeId);
    if (!node || !node.data.assetId) return {};

    const asset = assets[node.data.assetId as string];
    const ownValue = (asset?.value && typeof asset.value === 'object')
        ? asset.value as Record<string, any>
        : {};

    const connectedValue = getConnectedFieldValues(nodeId, nodes, edges, assets);

    return { ...ownValue, ...connectedValue };
}
