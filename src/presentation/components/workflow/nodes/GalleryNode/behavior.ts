import { NodeBehavior } from '@/presentation/engine/types/behavior';
import { StandardAssetBehavior } from '@/domain/registry/StandardBehavior';
import type { SynniaNode } from '@/presentation/types/project';
import type { Asset } from '@/domain/asset/types';
import type { PortValue } from '@/presentation/engine/ports/types';

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
            // value is always GalleryImageRef[]
            const images = Array.isArray(asset.value) ? asset.value : [];
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
