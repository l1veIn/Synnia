import { NodeBehavior, ConnectionContext } from '@core/engine/types/behavior';
import { StandardAssetBehavior } from '@core/registry/StandardBehavior';
import type { SynniaNode } from '@/types/project';
import type { Asset } from '@/types/assets';
import type { PortValue } from '@core/engine/ports/types';

/**
 * RecipeNode Behavior
 * Extends StandardAssetBehavior with IoC hooks for port resolution and connection handling.
 */
export const RecipeBehavior: NodeBehavior = {
    ...StandardAssetBehavior,

    resolveOutput: (
        node: SynniaNode,
        asset: Asset | null,
        portId: string
    ): PortValue | null => {
        if (!asset?.value || typeof asset.value !== 'object') return null;

        const values = asset.value as Record<string, any>;

        switch (portId) {
            case 'reference':
            case 'origin':
                return {
                    type: 'json',
                    value: values,
                    meta: { nodeId: node.id, portId }
                };

            default:
                if (portId.startsWith('field:')) {
                    const fieldKey = portId.replace('field:', '');
                    if (values[fieldKey] !== undefined) {
                        const value = values[fieldKey];
                        return {
                            type: typeof value === 'object' ? 'json' : 'text',
                            value,
                            meta: { nodeId: node.id, portId }
                        };
                    }
                }
                if (values[portId] !== undefined) {
                    const value = values[portId];
                    return {
                        type: typeof value === 'object' ? 'json' : 'text',
                        value,
                        meta: { nodeId: node.id, portId }
                    };
                }
                return null;
        }
    },

    /**
     * Validate if this Recipe can accept the incoming connection.
     * Return null to allow, or error message to reject.
     */
    canConnect: (ctx: ConnectionContext): string | null => {
        const { edge, sourceNode, sourceAsset } = ctx;
        const targetHandle = edge.targetHandle;

        // Semantic handles always allowed
        if (!targetHandle || ['origin', 'product', 'output', 'trigger', 'reference'].includes(targetHandle)) {
            return null;
        }

        // Check source has data
        if (!sourceAsset?.value) {
            return 'Source node has no data';
        }

        // For JSON sources, check if source has the target field or any data
        const sourceValue = sourceAsset.value;
        if (typeof sourceValue === 'object' && sourceValue !== null) {
            const keys = Object.keys(sourceValue);
            if (keys.length === 0) {
                return 'Source object is empty';
            }
            // If target field exists in source, check it's not empty
            if (keys.includes(targetHandle)) {
                const fieldValue = (sourceValue as Record<string, any>)[targetHandle];
                if (fieldValue === undefined || fieldValue === null || fieldValue === '') {
                    return `Field '${targetHandle}' in source is empty`;
                }
            }
        }

        return null;  // Allow
    },

    /**
     * Handle connections TO this Recipe node.
     * Extract data from source and auto-fill target field.
     */
    onConnect: (ctx: ConnectionContext): Record<string, any> | null => {
        const { edge, sourceAsset } = ctx;
        const targetHandle = edge.targetHandle;

        if (!targetHandle || ['origin', 'product', 'output', 'trigger', 'reference'].includes(targetHandle)) {
            return null;
        }

        if (!sourceAsset?.value) return null;

        // Extract value from source - no resolvePort needed!
        const sourceValue = sourceAsset.value;
        let value: any;

        if (Array.isArray(sourceValue) && sourceValue.length > 0) {
            // Array: extract field from first item
            const firstItem = sourceValue[0];
            if (typeof firstItem === 'object' && firstItem !== null) {
                value = firstItem[targetHandle] ?? firstItem;
            } else {
                value = firstItem;
            }
        } else if (typeof sourceValue === 'object' && sourceValue !== null) {
            // Object: extract field or use whole object
            value = (sourceValue as Record<string, any>)[targetHandle] ?? sourceValue;
        } else {
            // Primitive: use directly
            value = sourceValue;
        }

        return value !== undefined ? { [targetHandle]: value } : null;
    },
};
