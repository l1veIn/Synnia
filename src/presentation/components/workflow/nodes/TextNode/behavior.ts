import { NodeBehavior } from '@/presentation/engine/types/behavior';
import { StandardAssetBehavior } from '@/domain/registry/StandardBehavior';
import type { SynniaNode } from '@/presentation/types/project';
import type { Asset } from '@/domain/asset/types';
import type { PortValue } from '@/presentation/engine/ports/types';

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
            // New structure: extract content from value object
            const value = asset?.value as Record<string, any> | null;
            const content = value?.content ?? '';
            return {
                type: 'text',
                value: content,
                meta: { nodeId: node.id, portId }
            };
        }
        return null;
    },

    // No input ports, onConnect not needed
};
