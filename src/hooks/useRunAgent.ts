import { useWorkflowStore } from '@/store/workflowStore';
import { getSystemAgent } from '@/lib/systemAgents';
import { FormAssetContent } from '@/types/assets';
import { toast } from 'sonner';
import { useCallback } from 'react';
import { NodeType } from '@/types/project';
import { getNodePayload } from '@/lib/engine/DataPayload';

export function useRunAgent() {
    const { getAsset, addNode, updateNodeData } = useWorkflowStore();

    const runAgent = useCallback(async (nodeId: string, assetId: string) => {
        // Access latest state directly
        const store = useWorkflowStore.getState();
        const asset = store.getAsset(assetId);
        
        if (!asset) return;

        const agentId = asset.metadata.extra?.agentId;
        if (!agentId) return;

        const agent = getSystemAgent(agentId);
        if (!agent) {
             toast.error(`Agent definition not found: ${agentId}`);
             return;
        }

        // 2. Set Node State to Running (optimistic)
        updateNodeData(nodeId, { state: 'running', errorMessage: undefined });

        try {
            // 1. Resolve Inputs (Static + Dynamic)
            const content = asset.content as FormAssetContent;
            const staticValues = content.values || {};
            const dynamicValues: Record<string, any> = {};

            // Find edges connected to specific handles (Left Handles)
            const incomingEdges = store.edges.filter(e => e.target === nodeId && e.targetHandle);
            
            for (const edge of incomingEdges) {
                const fieldKey = edge.targetHandle!; 
                // Use the standardized Payload Extractor
                const payload = getNodePayload(edge.source);
                
                if (payload) {
                    dynamicValues[fieldKey] = payload.value;
                }
            }

            const effectiveValues = { ...staticValues, ...dynamicValues };

            // 2. Runtime Validation
            const schema = content.schema || [];
            for (const field of schema) {
                const val = effectiveValues[field.key];
                
                // A. Check Required
                // Note: Boolean false is a valid value, only check null/undefined/empty string
                if (field.rules?.required && (val === undefined || val === null || val === '')) {
                    throw new Error(`Missing required input: ${field.label || field.key}`);
                }

                // B. Check Object Keys (Runtime Shape Check)
                if (field.type === 'object' && field.rules?.requiredKeys && val) {
                    const reqKeys = field.rules.requiredKeys;
                    if (typeof val !== 'object') {
                        throw new Error(`Field '${field.key}' expects an object, got ${typeof val}`);
                    }
                    
                    const missingKeys = reqKeys.filter(k => !(k in val));
                    if (missingKeys.length > 0) {
                        throw new Error(`Field '${field.key}' (Object) is missing keys: ${missingKeys.join(', ')}`);
                    }
                }
            }

            // Debug: Log Final Payload
            console.log('🚀 [RunAgent] Executing with Payload:', effectiveValues);

            // 3. Execution
            const result = await agent.execute(effectiveValues);
            
            // 4. Create Result Node
            const node = store.nodes.find(n => n.id === nodeId);
            if (!node) return;
            
            // Calculate Position (Bottom)
            const targetPos = {
                x: node.position.x,
                y: node.position.y + (node.measured?.height || 200) + 100
            };

            // Use TextNode for simple text result, or JSON for object
            // TODO: Better result node mapping
            const resultType = typeof result.content === 'object' ? NodeType.JSON : NodeType.TEXT;
            
            const resultNodeId = addNode(NodeType.ASSET, targetPos, {
                assetType: typeof result.content === 'object' ? 'json' : 'text',
                content: result.content,
                assetName: `Result: ${agent.name}`
            });

            // 5. Connect (Source Bottom -> Target Top)
            store.onConnect({
                source: nodeId,
                sourceHandle: 'product', // Explicit 'product' handle
                target: resultNodeId,
                targetHandle: null // Default Top
            });

            toast.success("Execution successful");
            updateNodeData(nodeId, { state: 'success' }); 
            setTimeout(() => updateNodeData(nodeId, { state: 'idle' }), 2000);

        } catch (e: any) {
            console.error(e);
            toast.error(e.message || String(e));
            updateNodeData(nodeId, { state: 'error', errorMessage: e.message || String(e) });
        }
    }, [getAsset, addNode, updateNodeData]);

    return { runAgent };
}