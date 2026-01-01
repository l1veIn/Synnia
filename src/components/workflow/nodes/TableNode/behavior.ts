import { NodeBehavior } from '@core/engine/types/behavior';
import { StandardAssetBehavior } from '@core/registry/StandardBehavior';
import type { SynniaNode } from '@/types/project';
import type { Asset } from '@/types/assets';
import type { PortValue } from '@core/engine/ports/types';

/**
 * TableNode Behavior
 */
export const TableBehavior: NodeBehavior = {
    ...StandardAssetBehavior,

    resolveOutput: (
        node: SynniaNode,
        asset: Asset | null,
        portId: string
    ): PortValue | null => {
        if (!asset?.value) return null;

        const rows = Array.isArray(asset.value)
            ? asset.value
            : (asset.value as any).rows || [];

        switch (portId) {
            case 'output':
            case 'origin':
                return {
                    type: 'array',
                    value: rows,
                    meta: { nodeId: node.id, portId }
                };

            default:
                if (portId.startsWith('field:') && rows.length > 0) {
                    const fieldKey = portId.replace('field:', '');
                    const firstRow = rows[0];
                    if (firstRow && firstRow[fieldKey] !== undefined) {
                        const value = firstRow[fieldKey];
                        return {
                            type: typeof value === 'object' ? 'json' : 'text',
                            value,
                            meta: { nodeId: node.id, portId }
                        };
                    }
                }
                return null;
        }
    },

    // No input ports, onConnect not needed
};
