import { getRecipe } from '@/lib/recipes';
import { FormAssetContent } from '@/types/assets';
import { toast } from 'sonner';
import { useCallback } from 'react';
import { NodeType } from '@/types/project';
import { getNodePayload } from '@/lib/engine/DataPayload';
import { useWorkflowStore } from '@/store/workflowStore';
import { graphEngine } from '@/lib/engine/GraphEngine';
import { ExecutionContext } from '@/types/recipe';

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
            // Get static values from asset (FormAssetContent)
            let staticValues: Record<string, any> = {};

            if (node.data.assetId) {
                const asset = store.assets[node.data.assetId as string];
                if (asset?.content && typeof asset.content === 'object') {
                    const content = asset.content as FormAssetContent;
                    staticValues = content?.values || {};
                }
            }

            // Resolve dynamic values from connections
            const dynamicValues: Record<string, any> = {};
            const incomingEdges = store.edges.filter(e => e.target === nodeId && e.targetHandle);

            for (const edge of incomingEdges) {
                const fieldKey = edge.targetHandle!;
                // Skip trigger handle
                if (fieldKey === 'trigger') continue;

                const payload = getNodePayload(edge.source);
                if (payload) {
                    dynamicValues[fieldKey] = payload.value;
                }
            }

            const effectiveValues = { ...staticValues, ...dynamicValues };

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

            console.log(`🚀 [RunRecipe] Executing ${recipe.id} with:`, effectiveValues);

            // --- Build Context ---
            const ctx: ExecutionContext = {
                inputs: effectiveValues,
                nodeId,
                node,
                engine: graphEngine
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

            // --- Handle createNodes (if recipe wants to create product nodes) ---
            if (result.createNodes && result.createNodes.length > 0) {
                const freshNode = useWorkflowStore.getState().nodes.find(n => n.id === nodeId);
                if (!freshNode) return;

                for (const nodeSpec of result.createNodes) {
                    let targetPos = { x: freshNode.position.x, y: freshNode.position.y };

                    if (nodeSpec.position === 'below') {
                        targetPos.y += (freshNode.measured?.height || 200) + 100;
                    } else if (nodeSpec.position === 'right') {
                        targetPos.x += (freshNode.measured?.width || 250) + 100;
                    } else if (nodeSpec.position && typeof nodeSpec.position === 'object') {
                        targetPos = nodeSpec.position;
                    }

                    const newNodeId = graphEngine.mutator.addNode(nodeSpec.type, targetPos, nodeSpec.data);

                    // Auto-connect if it's a typical product -> input pattern
                    graphEngine.connect({
                        source: nodeId,
                        sourceHandle: 'product',
                        target: newNodeId,
                        targetHandle: 'input'
                    });
                }
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
