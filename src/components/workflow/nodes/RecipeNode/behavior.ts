import { NodeBehavior, ConnectionContext } from '@core/engine/types/behavior';
import { StandardAssetBehavior } from '@core/registry/StandardBehavior';
import { getResolvedRecipe } from '@features/recipes';
import { useWorkflowStore } from '@/store/workflowStore';
import { getConnectedFieldValues } from '@/hooks/useInspector';
import type { SynniaNode } from '@/types/project';
import type { Asset, FieldDefinition } from '@/types/assets';
import type { PortValue } from '@core/engine/ports/types';

/**
 * Check if source value structure matches target field schema.
 * Supports implicit array[0]→object and object→[object] conversion.
 */
function checkSchemaCompatibility(
    sourceValue: any,
    targetField: FieldDefinition
): { compatible: boolean; convertedValue: any } {
    const targetType = targetField.type;
    const targetSchema = targetField.schema;

    // No value = incompatible
    if (sourceValue === undefined || sourceValue === null) {
        return { compatible: false, convertedValue: null };
    }

    // Target expects object
    if (targetType === 'object') {
        if (Array.isArray(sourceValue)) {
            // Implicit: array[0] → object
            const firstItem = sourceValue[0];
            if (firstItem && typeof firstItem === 'object') {
                return { compatible: true, convertedValue: firstItem };
            }
            return { compatible: false, convertedValue: null };
        }
        if (typeof sourceValue === 'object') {
            // Direct object match - validate schema keys if specified
            if (targetSchema && targetSchema.length > 0) {
                const requiredKeys = targetSchema.filter(f => f.required).map(f => f.key);
                const missingKeys = requiredKeys.filter(k => !(k in sourceValue));
                if (missingKeys.length > 0) {
                    // Warn but still allow (soft validation)
                    console.warn(`[RecipeBehavior] Missing keys: ${missingKeys.join(', ')}`);
                }
            }
            return { compatible: true, convertedValue: sourceValue };
        }
        return { compatible: false, convertedValue: null };
    }

    // Target expects array
    if (targetType === 'array') {
        if (Array.isArray(sourceValue)) {
            return { compatible: true, convertedValue: sourceValue };
        }
        if (typeof sourceValue === 'object') {
            // Implicit: object → [object]
            return { compatible: true, convertedValue: [sourceValue] };
        }
        return { compatible: false, convertedValue: null };
    }

    // Primitive types
    if (targetType === 'string') {
        return { compatible: true, convertedValue: String(sourceValue) };
    }
    if (targetType === 'number') {
        const num = Number(sourceValue);
        return { compatible: !isNaN(num), convertedValue: num };
    }
    if (targetType === 'boolean') {
        return { compatible: true, convertedValue: Boolean(sourceValue) };
    }

    // Default: allow any
    return { compatible: true, convertedValue: sourceValue };
}

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
        const store = useWorkflowStore.getState();

        // Get merged values: own asset values + connected field values
        const ownValue = (asset?.value as Record<string, any>) || {};
        const connectedValue = getConnectedFieldValues(
            node.id,
            store.nodes,
            store.edges,
            store.assets
        );
        const mergedValue = { ...ownValue, ...connectedValue };

        switch (portId) {
            case 'reference':
            case 'origin':
                return {
                    type: 'json',
                    value: mergedValue,
                    meta: { nodeId: node.id, portId }
                };

            default:
                if (portId.startsWith('field:')) {
                    const fieldKey = portId.replace('field:', '');
                    if (mergedValue[fieldKey] !== undefined) {
                        const value = mergedValue[fieldKey];
                        return {
                            type: typeof value === 'object' ? 'json' : 'text',
                            value,
                            meta: { nodeId: node.id, portId }
                        };
                    }
                }
                if (mergedValue[portId] !== undefined) {
                    const value = mergedValue[portId];
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
     * Performs schema-based validation with implicit type conversion.
     */
    canConnect: (ctx: ConnectionContext): string | null => {
        const { edge, sourcePortValue, targetAsset } = ctx;
        const targetHandle = edge.targetHandle;

        // Skip validation for system handles
        if (!targetHandle || ['origin', 'product', 'output', 'trigger', 'reference'].includes(targetHandle)) {
            return null;
        }

        if (!sourcePortValue?.value) {
            return 'Source node has no output data';
        }

        // Get recipe schema for target field
        const recipeId = (targetAsset?.config as any)?.recipeId;
        if (recipeId) {
            const recipe = getResolvedRecipe(recipeId);
            if (recipe) {
                const targetField = recipe.inputSchema.find(f => f.key === targetHandle);
                if (targetField && (targetField.type === 'object' || targetField.type === 'array')) {
                    const { compatible } = checkSchemaCompatibility(sourcePortValue.value, targetField);
                    if (!compatible) {
                        return `Incompatible type: expected ${targetField.type}`;
                    }
                }
            }
        }

        return null;
    },

    /**
     * Handle connections TO this Recipe node.
     * 
     * NEW: No longer copies data to node storage.
     * Data is resolved dynamically via resolveOutput + useInspector.
     */
    onConnect: (_ctx: ConnectionContext): Record<string, any> | null => {
        // No data copying - Inspector reads connected data dynamically
        return null;
    },
};
