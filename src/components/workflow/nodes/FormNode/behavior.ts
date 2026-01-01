import { NodeBehavior, ConnectionContext } from '@core/engine/types/behavior';
import { StandardAssetBehavior } from '@core/registry/StandardBehavior';
import { resolvePort, resolveInputValue } from '@core/engine/ports';
import { useWorkflowStore } from '@/store/workflowStore';
import type { SynniaNode } from '@/types/project';
import type { Asset } from '@/types/assets';
import type { PortValue } from '@core/engine/ports/types';

/**
 * FormNode Behavior
 */
export const FormBehavior: NodeBehavior = {
    ...StandardAssetBehavior,

    resolveOutput: (
        node: SynniaNode,
        asset: Asset | null,
        portId: string
    ): PortValue | null => {
        if (!asset) return null;

        if (portId === 'output' || portId === 'origin') {
            return {
                type: 'json',
                value: asset.value || {},
                meta: { nodeId: node.id, portId }
            };
        }

        if (portId === 'array') {
            // Collect values from docked chain
            const store = useWorkflowStore.getState();
            const chain: any[] = [];

            let currentId: string | null = node.id;
            while (currentId) {
                const currentNode = store.nodes.find(n => n.id === currentId);
                if (!currentNode) break;

                const nodeAsset = currentNode.data.assetId
                    ? store.assets[currentNode.data.assetId]
                    : undefined;

                if (nodeAsset && nodeAsset.value) {
                    chain.unshift(nodeAsset.value);
                }

                currentId = currentNode.data.dockedTo as string | null;
            }

            return {
                type: 'array',
                value: chain,
                meta: { nodeId: node.id, portId }
            };
        }

        // Field-level access
        if (portId.startsWith('field:')) {
            const fieldKey = portId.replace('field:', '');
            const values = asset.value as Record<string, any>;
            if (values && values[fieldKey] !== undefined) {
                const value = values[fieldKey];
                return {
                    type: typeof value === 'object' ? 'json' : 'text',
                    value,
                    meta: { nodeId: node.id, portId }
                };
            }
        }

        return null;
    },

    onConnect: (ctx: ConnectionContext): Record<string, any> | null => {
        const { edge, sourceAsset } = ctx;
        const targetHandle = edge.targetHandle;
        if (!targetHandle || ['origin', 'output', 'array'].includes(targetHandle)) return null;

        const portValue = resolvePort(ctx.sourceNode, sourceAsset, edge.sourceHandle || 'origin');
        const value = resolveInputValue(portValue, targetHandle);
        return value !== undefined ? { [targetHandle]: value } : null;
    },
};
