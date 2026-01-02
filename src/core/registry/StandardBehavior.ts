import { NodeBehavior } from '@core/engine/types/behavior';
import type { SynniaNode } from '@/types/project';
import type { Asset } from '@/types/assets';
import type { PortValue } from '@core/engine/ports/types';

/**
 * Standard Behavior for Asset Nodes (Text, Image, etc.)
 * Provides sensible defaults for all behavior hooks.
 */
export const StandardAssetBehavior: NodeBehavior = {

    /**
     * Default resolveOutput: returns asset.value for semantic ports.
     * Nodes that need custom resolution should override this.
     */
    resolveOutput: (
        node: SynniaNode,
        asset: Asset | null,
        portId: string
    ): PortValue | null => {
        if (!asset?.value) return null;

        // Semantic ports (origin, output) return entire value
        if (portId === 'origin' || portId === 'output') {
            const value = asset.value;
            const type = Array.isArray(value) ? 'array'
                : typeof value === 'object' ? 'json'
                    : 'text';
            return { type, value, meta: { nodeId: node.id, portId } };
        }

        // Field-level ports extract from value
        if (portId.startsWith('field:') && typeof asset.value === 'object') {
            const fieldKey = portId.replace('field:', '');
            const values = asset.value as Record<string, any>;
            if (values[fieldKey] !== undefined) {
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
     * Collapse/Expand logic with height backup/restore.
     */
    onCollapse: (node, isCollapsed, context) => {
        const patches = [];

        const newStyle = { ...node.style };
        const newOther: { expandedHeight?: number; enableResize?: boolean } = { ...(node.data.other || {}) };

        let newHeight: number | undefined;

        if (isCollapsed) {
            let currentHeight = node.style?.height;
            if (typeof currentHeight !== 'number') {
                currentHeight = node.measured?.height || node.height;
            }

            if (typeof currentHeight === 'number' && currentHeight > 60) {
                newOther.expandedHeight = currentHeight;
            }

            newHeight = 50;

        } else {
            if (newOther.expandedHeight) {
                newHeight = newOther.expandedHeight;
            }
        }

        patches.push({
            id: node.id,
            patch: {
                height: newHeight,
                style: {
                    ...newStyle,
                    height: newHeight
                },
                data: {
                    ...node.data,
                    collapsed: isCollapsed,
                    other: newOther
                }
            }
        });

        return patches;
    }
};
