import { getRecipe } from '@features/recipes';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { useWorkflowStore } from '@/store/workflowStore';
import { graphEngine } from '@core/engine/GraphEngine';
import { ExecutionContext } from '@/types/recipe';
import { nodeRegistry } from '@core/registry/NodeRegistry';
import { getConnectedFieldValues } from '@/hooks/useInspector';

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
        graphEngine.updateNode(nodeId, {
            data: { state: 'running', errorMessage: undefined, executionResult: undefined }
        });

        try {
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
                engine: graphEngine,
                manifest: recipe.manifest,
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
            const outputConfig = (recipe.manifest as any).output || (recipe.manifest as any).executor?.output;

            if (outputConfig && result.data && !result.createNodes) {
                const nodeSpecs = graphEngine.mutator.buildNodesFromConfig(
                    Array.isArray(result.data) ? result.data : [result.data],
                    outputConfig
                );
                result.createNodes = nodeSpecs;
            }

            // --- Handle createNodes (if recipe wants to create product nodes) ---
            if (result.createNodes && result.createNodes.length > 0) {
                const freshStore2 = useWorkflowStore.getState();
                const freshNode2 = freshStore2.nodes.find(n => n.id === nodeId);
                if (!freshNode2) return;

                const existingOutputEdge = freshStore2.edges.find(e =>
                    e.source === nodeId &&
                    e.sourceHandle === 'product' &&
                    e.data?.edgeType === 'output'
                );

                const existingProductNode = existingOutputEdge
                    ? freshStore2.nodes.find(n => n.id === existingOutputEdge.target)
                    : null;

                if (existingProductNode && result.createNodes.length === 1) {
                    const nodeSpec = result.createNodes[0];
                    const specData = nodeSpec.data as any;
                    const existingAsset = freshStore2.assets[existingProductNode.data.assetId as string];

                    const isCollection = nodeRegistry.isCollection(existingProductNode.type);
                    const nodeDef = nodeRegistry.getDefinition(existingProductNode.type);

                    if (isCollection && existingAsset?.value && specData.content && nodeDef?.hooks) {
                        const { getItems, mergeItems } = nodeDef.hooks;

                        if (getItems && mergeItems) {
                            const existingItems = getItems(existingAsset);
                            const newItems = Array.isArray(specData.content)
                                ? specData.content
                                : getItems({ ...existingAsset, value: specData.content });
                            const mergedItems = mergeItems(existingItems, newItems);
                            graphEngine.assets.update(existingAsset.id, mergedItems);
                        }
                    } else {
                        if (existingAsset && specData.content) {
                            graphEngine.assets.update(existingAsset.id, specData.content);
                        }
                    }
                    return;
                }

                // --- Create new nodes ---
                let prevNodeId: string | null = null;
                const NODE_HEIGHT = 120;

                for (let i = 0; i < result.createNodes.length; i++) {
                    const nodeSpec = result.createNodes[i];
                    let targetPos = { x: freshNode2.position.x, y: freshNode2.position.y };

                    if (nodeSpec.position === 'below') {
                        targetPos.y += (freshNode2.measured?.height || 200) + 100;
                    } else if (nodeSpec.position === 'right') {
                        targetPos.x += (freshNode2.measured?.width || 250) + 100;
                    } else if (nodeSpec.position && typeof nodeSpec.position === 'object') {
                        targetPos = nodeSpec.position;
                    }

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

                    const { content, assetType, assetName, ...restData } = nodeSpec.data as any;

                    const newNodeId = graphEngine.mutator.addNode(nodeSpec.type, targetPos, {
                        content,
                        assetType,
                        assetName,
                        assetConfig: nodeSpec.config ? { schema: nodeSpec.config.schema, ...nodeSpec.config.extra } : undefined,
                        ...restData,
                        ...(dockedToId ? { dockedTo: dockedToId } : {})
                    });

                    // First node gets product edge
                    if (i === 0) {
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
