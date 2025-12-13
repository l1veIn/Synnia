import { getSystemAgent } from '@/lib/systemAgents';
import { FormAssetContent } from '@/types/assets';
import { toast } from 'sonner';
import { useCallback } from 'react';
import { NodeType } from '@/types/project';
import { getNodePayload } from '@/lib/engine/DataPayload';
import { useWorkflowStore } from '@/store/workflowStore';
import { graphEngine } from '@/lib/engine/GraphEngine';

export function useRunAgent() {
    const runAgent = useCallback(async (nodeId: string, assetId: string) => {
        const store = useWorkflowStore.getState();
        const asset = store.assets[assetId];

        if (!asset) return;

        const agentId = asset.metadata.extra?.agentId;
        if (!agentId) return;

        const agent = getSystemAgent(agentId);
        if (!agent) {
            toast.error(`Agent definition not found: ${agentId}`);
            return;
        }

        // Set Node State to Running
        graphEngine.updateNode(nodeId, { data: { state: 'running', errorMessage: undefined } });

        try {
            // Resolve Inputs
            const content = asset.content as FormAssetContent;
            const staticValues = content.values || {};
            const dynamicValues: Record<string, any> = {};

            const incomingEdges = store.edges.filter(e => e.target === nodeId && e.targetHandle);

            for (const edge of incomingEdges) {
                const fieldKey = edge.targetHandle!;
                const payload = getNodePayload(edge.source);

                if (payload) {
                    dynamicValues[fieldKey] = payload.value;
                }
            }

            const effectiveValues = { ...staticValues, ...dynamicValues };

            // Validation
            const schema = content.schema || [];
            for (const field of schema) {
                const val = effectiveValues[field.key];

                if (field.rules?.required && (val === undefined || val === null || val === '')) {
                    throw new Error(`Missing required input: ${field.label || field.key}`);
                }

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

            console.log('🚀 [RunAgent] Executing with Payload:', effectiveValues);

            // Execution
            const result = await agent.execute(effectiveValues);

            // Create Result Node
            const node = store.nodes.find(n => n.id === nodeId);
            if (!node) return;

            const targetPos = {
                x: node.position.x,
                y: node.position.y + (node.measured?.height || 200) + 100
            };

            const resultNodeId = graphEngine.mutator.addNode(NodeType.ASSET, targetPos, {
                assetType: typeof result.content === 'object' ? 'json' : 'text',
                content: result.content,
                assetName: `Result: ${agent.name}`
            });

            // Connect
            graphEngine.connect({
                source: nodeId,
                sourceHandle: 'product',
                target: resultNodeId,
                targetHandle: 'input'
            });

            toast.success("Execution successful");
            graphEngine.updateNode(nodeId, { data: { state: 'success' } });
            setTimeout(() => graphEngine.updateNode(nodeId, { data: { state: 'idle' } }), 2000);

        } catch (e: any) {
            console.error(e);
            toast.error(e.message || String(e));
            graphEngine.updateNode(nodeId, { data: { state: 'error', errorMessage: e.message || String(e) } });
        }
    }, []);

    return { runAgent };
}