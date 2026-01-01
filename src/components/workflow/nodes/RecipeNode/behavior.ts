import { NodeBehavior, ConnectionContext } from '@core/engine/types/behavior';
import { StandardAssetBehavior } from '@core/registry/StandardBehavior';
import { resolvePort, resolveInputValue } from '@core/engine/ports';
import type { SynniaNode } from '@/types/project';
import type { Asset } from '@/types/assets';
import type { PortValue } from '@core/engine/ports/types';

/**
 * RecipeNode Behavior
 * Extends StandardAssetBehavior with IoC hooks for port resolution and connection handling.
 */
export const RecipeBehavior: NodeBehavior = {
    // Inherit collapse behavior from standard
    ...StandardAssetBehavior,

    /**
     * Resolve output value for Recipe ports.
     * Form values are stored directly in asset.value (V2 architecture).
     */
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
                // Return entire form values
                return {
                    type: 'json',
                    value: values,
                    meta: { nodeId: node.id, portId }
                };

            default:
                // Field-level access: extract specific field
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
                // Direct field access (for dynamic field ports)
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
     * Handle connections TO this Recipe node.
     * Auto-fill target fields based on incoming data.
     */
    onConnect: (ctx: ConnectionContext): Record<string, any> | null => {
        const { edge, sourceAsset } = ctx;
        const targetHandle = edge.targetHandle;
        if (!targetHandle) return null;

        // Skip semantic handles
        if (['origin', 'product', 'output', 'trigger', 'reference'].includes(targetHandle)) {
            return null;
        }

        // Resolve source value and auto-fill
        const portValue = resolvePort(ctx.sourceNode, sourceAsset, edge.sourceHandle || 'origin');
        const value = resolveInputValue(portValue, targetHandle);

        return value !== undefined ? { [targetHandle]: value } : null;
    },
};
