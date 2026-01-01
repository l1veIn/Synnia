import { NodeBehavior } from '@core/engine/types/behavior';
import { StandardAssetBehavior } from '@core/registry/StandardBehavior';
import type { SynniaNode } from '@/types/project';
import type { Asset } from '@/types/assets';
import type { PortValue } from '@core/engine/ports/types';

/**
 * GalleryNode Behavior
 */
export const GalleryBehavior: NodeBehavior = {
    ...StandardAssetBehavior,

    resolveOutput: (
        node: SynniaNode,
        asset: Asset | null,
        portId: string
    ): PortValue | null => {
        if (!asset?.value) return null;

        if (portId === 'output' || portId === 'origin') {
            const images = Array.isArray(asset.value)
                ? asset.value
                : (asset.value as any).images || [];
            return {
                type: 'array',
                value: images,
                meta: { nodeId: node.id, portId }
            };
        }
        return null;
    },

    // No input ports, onConnect not needed
};
