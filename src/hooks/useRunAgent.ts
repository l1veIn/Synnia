import { useWorkflowStore } from '@/store/workflowStore';
import { getSystemAgent } from '@/lib/systemAgents';
import { FormAssetContent } from '@/types/assets';
import { toast } from 'sonner';
import { useCallback } from 'react';
import { NodeType } from '@/types/project';

export function useRunAgent() {
    const { getAsset, addNode, updateNodeData } = useWorkflowStore();

    const runAgent = useCallback(async (nodeId: string, assetId: string) => {
        const asset = getAsset(assetId);
        if (!asset) return;

        const agentId = asset.metadata.extra?.agentId;
        if (!agentId) return;

        const agent = getSystemAgent(agentId);
        if (!agent) {
             toast.error(`Agent definition not found: ${agentId}`);
             return;
        }

        const content = asset.content as FormAssetContent;
        const values = content.values || {};

        // 1. Set Node State to Running
        updateNodeData(nodeId, { state: 'running', errorMessage: undefined });

        try {
            // 2. Execution
            const result = await agent.execute(values);
            
            // 3. Create Result Node
            const node = useWorkflowStore.getState().nodes.find(n => n.id === nodeId);
            if (!node) return;
            
            // Calculate Position (Right side)
            const targetPos = {
                x: node.position.x + (node.measured?.width || 300) + 100,
                y: node.position.y
            };

            const resultNodeId = addNode(NodeType.ASSET, targetPos, {
                assetType: result.type as any,
                content: result.content,
                assetName: `Result: ${agent.name}`
            });

            // 4. Connect
            useWorkflowStore.getState().onConnect({
                source: nodeId,
                sourceHandle: null,
                target: resultNodeId,
                targetHandle: null
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