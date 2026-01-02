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
     * ctx.sourcePortValue is pre-resolved by the engine.
     */
    canConnect: (ctx: ConnectionContext): string | null => {
        const { edge, sourcePortValue } = ctx;
        const targetHandle = edge.targetHandle;

        if (!targetHandle || ['origin', 'product', 'output', 'trigger', 'reference'].includes(targetHandle)) {
            return null;
        }

        if (!sourcePortValue?.value) {
            return 'Source node has no output data';
        }

        return null;
    },

    /**
     * Handle connections TO this Recipe node.
     * ctx.sourcePortValue is pre-resolved - just extract the field we need.
     */
    onConnect: (ctx: ConnectionContext): Record<string, any> | null => {
        const { edge, sourcePortValue } = ctx;
        const targetHandle = edge.targetHandle;

        if (!targetHandle || ['origin', 'product', 'output', 'trigger', 'reference'].includes(targetHandle)) {
            return null;
        }

        if (!sourcePortValue?.value) return null;

        // Extract value from pre-resolved port output
        const resolvedValue = sourcePortValue.value;
        let value: any;

        if (Array.isArray(resolvedValue) && resolvedValue.length > 0) {
            // Array (e.g., Selector output): extract field from first item
            const firstItem = resolvedValue[0];
            if (typeof firstItem === 'object' && firstItem !== null) {
                value = firstItem[targetHandle] ?? firstItem;
            } else {
                value = firstItem;
            }
        } else if (typeof resolvedValue === 'object' && resolvedValue !== null) {
            // Object: extract field or use whole object
            value = (resolvedValue as Record<string, any>)[targetHandle] ?? resolvedValue;
        } else {
            // Primitive: use directly
            value = resolvedValue;
        }

        return value !== undefined ? { [targetHandle]: value } : null;
    },
};
