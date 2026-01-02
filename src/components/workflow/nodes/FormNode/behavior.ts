import { NodeBehavior, ConnectionContext } from '@core/engine/types/behavior';
import { StandardAssetBehavior } from '@core/registry/StandardBehavior';
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

    /**
     * Validate if this Form can accept the incoming connection.
     */
    canConnect: (ctx: ConnectionContext): string | null => {
        const { edge, sourcePortValue } = ctx;
        const targetHandle = edge.targetHandle;

        if (!targetHandle || ['origin', 'output', 'array'].includes(targetHandle)) {
            return null;
        }

        if (!sourcePortValue?.value) {
            return 'Source node has no output data';
        }

        return null;
    },

    /**
     * Handle connections TO this Form node.
     */
    onConnect: (ctx: ConnectionContext): Record<string, any> | null => {
        const { edge, sourcePortValue } = ctx;
        const targetHandle = edge.targetHandle;

        if (!targetHandle || ['origin', 'output', 'array'].includes(targetHandle)) {
            return null;
        }

        if (!sourcePortValue?.value) return null;

        const resolvedValue = sourcePortValue.value;
        let value: any;

        if (Array.isArray(resolvedValue) && resolvedValue.length > 0) {
            const firstItem = resolvedValue[0];
            if (typeof firstItem === 'object' && firstItem !== null) {
                value = firstItem[targetHandle] ?? firstItem;
            } else {
                value = firstItem;
            }
        } else if (typeof resolvedValue === 'object' && resolvedValue !== null) {
            value = (resolvedValue as Record<string, any>)[targetHandle] ?? resolvedValue;
        } else {
            value = resolvedValue;
        }

        return value !== undefined ? { [targetHandle]: value } : null;
    },
};
