import { NodeBehavior } from '@core/engine/types/behavior';
import { StandardAssetBehavior } from '@core/registry/StandardBehavior';
import type { SynniaNode } from '@/types/project';
import type { Asset, isRecordAsset } from '@/types/assets';
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
            if (!asset || asset.valueType !== 'record') return null;
            // New structure: value is { src, width, height, ... }
            const value = asset.value as Record<string, any>;
            const meta = (asset.config as any)?.meta || {};
            return {
                type: 'json',  // Unified: image is just json with url field
                value: {
                    url: value.src || '',
                    width: value.width ?? meta.width,
                    height: value.height ?? meta.height,
                    mimeType: value.mimeType
                },
                meta: { nodeId: node.id, portId }
            };
        }
        return null;
    },

    // No input ports, onConnect not needed
};
