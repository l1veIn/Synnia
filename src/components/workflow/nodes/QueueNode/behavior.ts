import { NodeBehavior } from '@core/engine/types/behavior';
import { StandardAssetBehavior } from '@core/registry/StandardBehavior';
import type { SynniaNode } from '@/types/project';
import type { Asset } from '@/types/assets';
import type { PortValue } from '@core/engine/ports/types';

/**
 * QueueNode Behavior
 */
export const QueueBehavior: NodeBehavior = {
    ...StandardAssetBehavior,

    resolveOutput: (
        node: SynniaNode,
        asset: Asset | null,
        portId: string
    ): PortValue | null => {
        if (!asset?.value) return null;

        if (portId === 'output') {
            const tasks = Array.isArray(asset.value)
                ? asset.value
                : (asset.value as any).tasks || [];
            return {
                type: 'array',
                value: tasks.filter((t: any) => t.status === 'success').map((t: any) => t.result),
                meta: { nodeId: node.id, portId }
            };
        }

        if (portId === 'origin') {
            const tasks = Array.isArray(asset.value)
                ? asset.value
                : (asset.value as any).tasks || [];
            return {
                type: 'array',
                value: tasks,
                meta: { nodeId: node.id, portId }
            };
        }

        return null;
    },

    // No input ports, onConnect not needed
};
