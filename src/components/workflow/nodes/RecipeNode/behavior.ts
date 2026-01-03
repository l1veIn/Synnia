import { NodeBehavior, ConnectionContext } from '@core/engine/types/behavior';
import { StandardAssetBehavior } from '@core/registry/StandardBehavior';
import { getResolvedRecipe } from '@features/recipes';
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
     * Performs implicit type conversion (array↔object) based on target field type.
     */
    onConnect: (ctx: ConnectionContext): Record<string, any> | null => {
        const { edge, sourcePortValue, targetAsset } = ctx;
        const targetHandle = edge.targetHandle;

        if (!targetHandle || ['origin', 'product', 'output', 'trigger', 'reference'].includes(targetHandle)) {
            return null;
        }

        if (!sourcePortValue?.value) return null;

        const resolvedValue = sourcePortValue.value;

        // Get recipe schema for target field
        const recipeId = (targetAsset?.config as any)?.recipeId;
        if (recipeId) {
            const recipe = getResolvedRecipe(recipeId);
            if (recipe) {
                const targetField = recipe.inputSchema.find(f => f.key === targetHandle);
                if (targetField && (targetField.type === 'object' || targetField.type === 'array')) {
                    const { convertedValue } = checkSchemaCompatibility(resolvedValue, targetField);
                    if (convertedValue !== null) {
                        return { [targetHandle]: convertedValue };
                    }
                }
            }
        }

        // Fallback: legacy extraction logic for non-typed fields
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

