import { useWorkflowStore } from '@/store/workflowStore';
import { getSystemAgent } from '@/lib/systemAgents';
import { FormAssetContent } from '@/types/assets';
import { toast } from 'sonner';
import { useCallback } from 'react';
import { NodeType } from '@/types/project';
import { Position } from '@xyflow/react';

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

        // 1. Resolve Inputs (Static + Dynamic)
        const content = asset.content as FormAssetContent;
        const staticValues = content.values || {};
        const dynamicValues: Record<string, any> = {};

        // Find edges connected to specific handles (Left Handles)
        const incomingEdges = store.edges.filter(e => e.target === nodeId && e.targetHandle);
        
        for (const edge of incomingEdges) {
            const fieldKey = edge.targetHandle; 
            const sourceNode = store.nodes.find(n => n.id === edge.source);
            
            if (sourceNode && fieldKey && sourceNode.data.assetId) {
                const sourceAsset = store.getAsset(sourceNode.data.assetId);
                if (sourceAsset) {
                    // Inject the Full Asset Object
                    dynamicValues[fieldKey] = sourceAsset;
                }
            }
        }

        const effectiveValues = { ...staticValues, ...dynamicValues };

        // 2. Set Node State to Running
        updateNodeData(nodeId, { state: 'running', errorMessage: undefined });

        try {
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

            const resultNodeId = addNode(NodeType.ASSET, targetPos, {
                assetType: result.type as any,
                content: result.content,
                assetName: `Result: ${agent.name}`
            });

            // 5. Connect (Source Bottom -> Target Top)
            store.onConnect({
                source: nodeId,
                sourceHandle: null, // Default Bottom
                target: resultNodeId,
                targetHandle: null // Default Top
            });

            toast.success("Execution successful");
            updateNodeData(nodeId, { state: 'success' }); 
            setTimeout(() => updateNodeData(nodeId, { state: 'idle' }), 2000);

        } catch (e) {
            toast.error(String(e));
            updateNodeData(nodeId, { state: 'error', errorMessage: String(e) });
        }
    }, [getAsset, addNode, updateNodeData]);

    return { runAgent };
}