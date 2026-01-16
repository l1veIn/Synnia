import { NodeBehavior, ConnectionContext } from '@core/engine/types/behavior';
import { StandardAssetBehavior } from '@core/registry/StandardBehavior';
import { getResolvedRecipe } from '@features/recipes';
import { useWorkflowStore } from '@/store/workflowStore';
import { getConnectedFieldValues } from '@/hooks/useInspector';
import { smartResolveError } from '@core/engine/smartResolve';
import type { SynniaNode } from '@/types/project';
import type { Asset, FieldDefinition } from '@/types/assets';
import type { PortValue } from '@core/engine/ports/types';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a handle is a system-level handle that skips validation.
 */
function isSystemHandle(handle: string | null | undefined): boolean {
    if (!handle) return true;
    return ['origin', 'product', 'output', 'trigger', 'reference'].includes(handle);
}

/**
 * Get target field definition from target recipe.
 */
function getTargetFieldDefinition(
    targetAsset: Asset | null,
    targetHandle: string
): FieldDefinition | undefined {
    const recipeId = (targetAsset?.config as any)?.recipeId;
    if (!recipeId) return undefined;

    const recipe = getResolvedRecipe(recipeId);
    return recipe?.inputSchema.find(f => f.key === targetHandle);
}

/**
 * Validate capability-based ports (e.g., model:visionImage).
 * TODO: Migrate to CapabilityRegistry in the future.
 */
function validateCapabilityPort(
    portId: string,
    sourceNode: SynniaNode
): string | null {
    if (portId === 'visionImage') {
        if (sourceNode.type !== 'gallery') {
            return 'Reference Images port expects a Gallery node';
        }
    }
    return null;
}

// ============================================================================
// RecipeNode Behavior
// ============================================================================

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
     * 
     * TEP Crystallized Principle: "能提取 = 能连接"
     * Uses smartResolve to simulate runtime data extraction.
     */
    canConnect: (ctx: ConnectionContext): string | null => {
        const { edge, sourcePortValue, targetAsset, sourceNode } = ctx;
        const targetHandle = edge.targetHandle;

        // Skip system handles
        if (isSystemHandle(targetHandle)) {
            return null;
        }

        // Capability ports (model:xxx)
        if (targetHandle!.startsWith('model:')) {
            const portId = targetHandle!.replace('model:', '');
            return validateCapabilityPort(portId, sourceNode);
        }

        // Get target field definition
        const targetField = getTargetFieldDefinition(targetAsset, targetHandle!);
        if (!targetField) {
            // No schema info, allow connection (legacy compatibility)
            return null;
        }

        // No source data at all
        if (!sourcePortValue?.value) {
            return 'Source node has no output data. Run or fill it first.';
        }

        // Use smartResolve to validate
        // "能提取 = 能连接"
        const error = smartResolveError(sourcePortValue.value, targetField);
        return error;
    },

    /**
     * Handle connections TO this Recipe node.
     * Data is resolved dynamically via resolveOutput + useInspector.
     */
    onConnect: (_ctx: ConnectionContext): Record<string, any> | null => {
        return null;
    },
};
