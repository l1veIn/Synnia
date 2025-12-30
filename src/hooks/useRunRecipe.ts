import { getRecipe } from '@features/recipes';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { collectInputValues } from '@core/engine/ports';
import { useWorkflowStore } from '@/store/workflowStore';
import { graphEngine } from '@core/engine/GraphEngine';
import { ExecutionContext } from '@/types/recipe';
import { nodeRegistry } from '@core/registry/NodeRegistry';

/**
 * Hook to run a Recipe Definition.
 * Replaces useRunAgent for the new recipe system.
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
        graphEngine.updateNode(nodeId, {
            data: { state: 'running', errorMessage: undefined, executionResult: undefined }
        });

        try {
            // --- Resolve Inputs ---
            // RecordAsset: form values are stored directly in asset.value
            let staticValues: Record<string, any> = {};

            if (node.data.assetId) {
                const asset = store.assets[node.data.assetId as string];
                if (asset?.value && typeof asset.value === 'object') {
                    // Values are directly in asset.value
                    staticValues = asset.value as Record<string, any>;
                }
            }

            // Resolve dynamic values from connections using PortResolver
            const dynamicValues = collectInputValues(nodeId);

            // Apply default values from schema
            const defaultValues: Record<string, any> = {};
            for (const field of recipe.inputSchema) {
                if (field.defaultValue !== undefined) {
                    defaultValues[field.key] = field.defaultValue;
                }
            }

            // Merge: defaults < static < dynamic (later values override earlier)
            const effectiveValues = { ...defaultValues, ...staticValues, ...dynamicValues };

            // --- Validation ---
            for (const field of recipe.inputSchema) {
                const val = effectiveValues[field.key];

                if (field.rules?.required && (val === undefined || val === null || val === '')) {
                    throw new Error(`Missing required input: ${field.label || field.key}`);
                }

                if (field.type === 'object' && field.rules?.requiredKeys && val) {
                    if (typeof val !== 'object') {
                        throw new Error(`Field '${field.key}' expects an object, got ${typeof val}`);
                    }
                    const missingKeys = field.rules.requiredKeys.filter(k => !(k in val));
                    if (missingKeys.length > 0) {
                        throw new Error(`Field '${field.key}' missing keys: ${missingKeys.join(', ')}`);
                    }
                }
            }


            // --- Build Context ---
            // Get recipe-specific config from asset
            const assetConfig = node.data.assetId
                ? store.assets[node.data.assetId as string]?.config
                : undefined;
            const recipeConfig = assetConfig as any;

            const ctx: ExecutionContext = {
                inputs: effectiveValues,
                nodeId,
                node,
                engine: graphEngine,
                manifest: recipe.manifest,
                // Recipe V2: Include chat history and model config
                chatContext: recipeConfig?.chatContext?.messages,
                modelConfig: recipeConfig?.modelConfig,
            };


            // --- Execute ---
            const result = await recipe.execute(ctx);

            if (!result.success) {
                throw new Error(result.error || 'Execution failed');
            }

            // --- Store Result in Node Data ---
            graphEngine.updateNode(nodeId, {
                data: { executionResult: result.data }
            });

            // --- Build createNodes from output config if specified in manifest ---
            const executor = recipe.manifest.executor as any;
            const outputConfig = executor.output;

            if (outputConfig && result.data && !result.createNodes) {
                // Build nodes using GraphMutator
                const nodeSpecs = graphEngine.mutator.buildNodesFromConfig(
                    Array.isArray(result.data) ? result.data : [result.data],
                    outputConfig,
                    nodeId
                );
                result.createNodes = nodeSpecs;
            }

            // --- Handle createNodes (if recipe wants to create product nodes) ---
            if (result.createNodes && result.createNodes.length > 0) {
                const freshStore = useWorkflowStore.getState();
                const freshNode = freshStore.nodes.find(n => n.id === nodeId);
                if (!freshNode) return;

                // Check if there's an existing product node connected via Output Edge
                const existingOutputEdge = freshStore.edges.find(e =>
                    e.source === nodeId &&
                    e.sourceHandle === 'product' &&
                    e.data?.edgeType === 'output'
                );

                const existingProductNode = existingOutputEdge
                    ? freshStore.nodes.find(n => n.id === existingOutputEdge.target)
                    : null;

                // If there's an existing product node, update/append instead of creating new
                if (existingProductNode && result.createNodes.length === 1) {
                    const nodeSpec = result.createNodes[0];
                    const specData = nodeSpec.data as any;
                    const existingAsset = freshStore.assets[existingProductNode.data.assetId as string];

                    // Check if it's a collection type using nodeRegistry
                    const isCollection = nodeRegistry.isCollection(existingProductNode.type);
                    const nodeDef = nodeRegistry.getDefinition(existingProductNode.type);

                    if (isCollection && existingAsset?.value && specData.content && nodeDef?.hooks) {
                        // Use hooks for collection operations
                        const { getItems, mergeItems } = nodeDef.hooks;

                        if (getItems && mergeItems) {
                            // Get existing items using hook
                            const existingItems = getItems(existingAsset);

                            // Get new items from spec content
                            // For the incoming data, we need to extract items the same way
                            const newItems = Array.isArray(specData.content)
                                ? specData.content
                                : getItems({ ...existingAsset, value: specData.content });

                            // Merge using hook (hooks decide prepend/append strategy)
                            const mergedItems = mergeItems(existingItems, newItems);

                            // Update asset with merged items
                            graphEngine.assets.update(existingAsset.id, mergedItems);
                        }
                    } else {
                        // Non-collection: replace content entirely
                        if (existingAsset && specData.content) {
                            graphEngine.assets.update(existingAsset.id, specData.content);
                        }
                    }

                    // Done - no new nodes needed
                    return;
                }

                // --- Create new nodes (original logic for first-time execution) ---
                let prevNodeId: string | null = null;
                const NODE_HEIGHT = 120;

                for (let i = 0; i < result.createNodes.length; i++) {
                    const nodeSpec = result.createNodes[i];
                    let targetPos = { x: freshNode.position.x, y: freshNode.position.y };

                    if (nodeSpec.position === 'below') {
                        targetPos.y += (freshNode.measured?.height || 200) + 100;
                    } else if (nodeSpec.position === 'right') {
                        targetPos.x += (freshNode.measured?.width || 250) + 100;
                    } else if (nodeSpec.position && typeof nodeSpec.position === 'object') {
                        targetPos = nodeSpec.position;
                    }

                    // Handle docking: adjust position for docked nodes
                    let dockedToId: string | undefined;
                    if (nodeSpec.dockedTo === '$prev' && prevNodeId) {
                        dockedToId = prevNodeId;
                        const prevNode = useWorkflowStore.getState().nodes.find(n => n.id === prevNodeId);
                        if (prevNode) {
                            targetPos = {
                                x: prevNode.position.x,
                                y: prevNode.position.y + (prevNode.measured?.height || NODE_HEIGHT)
                            };
                        }
                    } else if (nodeSpec.dockedTo && nodeSpec.dockedTo !== '$prev') {
                        dockedToId = nodeSpec.dockedTo;
                    }


                    // Extract options that addNode expects from data
                    const { content, assetType, assetName, ...restData } = nodeSpec.data as any;

                    const newNodeId = graphEngine.mutator.addNode(nodeSpec.type, targetPos, {
                        content,
                        assetType,
                        assetName,
                        assetConfig: nodeSpec.assetConfig,  // Universal Output Adapter
                        ...restData,
                        ...(dockedToId ? { dockedTo: dockedToId } : {})
                    });

                    // Handle connections
                    if (nodeSpec.connectTo) {
                        graphEngine.connect({
                            source: nodeId,
                            sourceHandle: nodeSpec.connectTo.sourceHandle,
                            target: newNodeId,
                            targetHandle: nodeSpec.connectTo.targetHandle
                        });
                    } else if (i === 0) {
                        // Default: connect first node to recipe's 'product' output with Output Edge
                        graphEngine.updateNode(newNodeId, {
                            data: { hasProductHandle: true }
                        });

                        graphEngine.connectOutputEdge({
                            source: nodeId,
                            sourceHandle: 'product',
                            target: newNodeId,
                            targetHandle: 'origin'
                        });
                    }

                    prevNodeId = newNodeId;
                }

                // Fix docking layout after all nodes are created
                const updatedNodes = graphEngine.layout.fixDockingLayout(useWorkflowStore.getState().nodes);
                graphEngine.setNodes(updatedNodes);
            }

            toast.success(`${recipe.name} completed`);
            graphEngine.updateNode(nodeId, { data: { state: 'success' } });
            setTimeout(() => graphEngine.updateNode(nodeId, { data: { state: 'idle' } }), 2000);

        } catch (e: any) {
            console.error('[RunRecipe] Error:', e);
            toast.error(e.message || String(e));
            graphEngine.updateNode(nodeId, {
                data: { state: 'error', errorMessage: e.message || String(e) }
            });
        }
    }, []);

    return { runRecipe };
}
