import { NodeBehavior } from '@core/engine/types/behavior';
import { StandardAssetBehavior } from '@core/registry/StandardBehavior';
import { isImageAsset } from '@/types/assets';
import type { SynniaNode } from '@/types/project';
import type { Asset } from '@/types/assets';
import type { PortValue } from '@core/engine/ports/types';

/**
 * ImageNode Behavior
 */
export const ImageBehavior: NodeBehavior = {
    ...StandardAssetBehavior,

    resolveOutput: (
        node: SynniaNode,
        asset: Asset | null,
        portId: string
    ): PortValue | null => {
        if (portId === 'output' || portId === 'origin') {
            if (!asset || !isImageAsset(asset)) return null;
            const meta = asset.valueMeta || {};
            const url = typeof asset.value === 'string' ? asset.value : '';
            return {
                type: 'json',  // Unified: image is just json with url field
                value: { url, width: meta.width, height: meta.height, mimeType: asset.config?.mimeType },
                meta: { nodeId: node.id, portId }
            };
        }
        return null;
    },

    // No input ports, onConnect not needed
};
