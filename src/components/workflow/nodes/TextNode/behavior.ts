import { NodeBehavior } from '@core/engine/types/behavior';
import { StandardAssetBehavior } from '@core/registry/StandardBehavior';
import type { SynniaNode } from '@/types/project';
import type { Asset } from '@/types/assets';
import type { PortValue } from '@core/engine/ports/types';

/**
 * TextNode Behavior
 */
export const TextBehavior: NodeBehavior = {
    ...StandardAssetBehavior,

    resolveOutput: (
        node: SynniaNode,
        asset: Asset | null,
        portId: string
    ): PortValue | null => {
        if (portId === 'output' || portId === 'origin') {
            return {
                type: 'text',
                value: asset?.value || '',
                meta: { nodeId: node.id, portId }
            };
        }
        return null;
    },

    // No input ports, onConnect not needed
};
