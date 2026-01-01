import { NodeBehavior } from '@core/engine/types/behavior';
import { StandardAssetBehavior } from '@core/registry/StandardBehavior';
import type { SynniaNode } from '@/types/project';
import type { Asset } from '@/types/assets';
import type { PortValue } from '@core/engine/ports/types';

/**
 * SelectorNode Behavior
 * Extends StandardAssetBehavior with IoC hooks for port resolution and connection handling.
 */
export const SelectorBehavior: NodeBehavior = {
    // Inherit collapse behavior from standard
    ...StandardAssetBehavior,

    /**
     * Resolve output value for Selector ports.
     * Handles the complexity of extracting selected items from various data formats.
     */
    resolveOutput: (
        node: SynniaNode,
        asset: Asset | null,
        portId: string
    ): PortValue | null => {
        if (!asset?.value) return null;

        // Parse items and selectedIds from different asset formats
        let items: any[] = [];
        let selectedIds: string[] = [];

        if (Array.isArray(asset.value)) {
            // V3 format: items in asset.value, selected in node.data
            items = asset.value;
            selectedIds = (node.data as any)?.selected || [];
        } else {
            // Legacy format: options and selected in asset.value
            const content = asset.value as any;
            items = content.options || [];
            selectedIds = content.selected || [];
        }

        const selectedItems = items.filter((opt: any) => selectedIds.includes(opt.id));

        // Handle different port types
        switch (portId) {
            case 'output':
                // Full selected items array
                return {
                    type: 'array',
                    value: selectedItems,
                    meta: { nodeId: node.id, portId }
                };

            case 'origin':
                // All items (for downstream processing)
                return {
                    type: 'array',
                    value: items,
                    meta: { nodeId: node.id, portId }
                };

            default:
                // Field-level access: extract specific field from first selected item
                if (portId.startsWith('field:')) {
                    const fieldKey = portId.replace('field:', '');
                    if (selectedItems.length > 0 && selectedItems[0][fieldKey] !== undefined) {
                        const value = selectedItems[0][fieldKey];
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
