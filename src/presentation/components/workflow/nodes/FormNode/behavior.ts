import { NodeBehavior, ConnectionContext } from '@/presentation/engine/types/behavior';
import { StandardAssetBehavior } from '@/domain/registry/StandardBehavior';
import { useWorkflowStore } from '@/store/workflowStore';
import { getConnectedFieldValues } from '@/presentation/hooks/useInspector';
import { smartResolveError } from '@/domain/edge/ValueMappingService';
import type { SynniaNode } from '@/presentation/types/project';
import type { Asset, FieldDefinition } from '@/domain/asset/types';
import type { PortValue } from '@/presentation/engine/ports/types';
import { resolveNodeAssetId } from '@/domain/node/utils/nodeAsset';

/**
 * FormNode Behavior
 * 
 * Key architecture: resolveOutput merges own values + connected values
 * to support chaining (A → B → C).
 */
export const FormBehavior: NodeBehavior = {
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

        if (portId === 'output' || portId === 'origin') {
            return {
                type: 'json',
                value: mergedValue,
                meta: { nodeId: node.id, portId }
            };
        }

        if (portId === 'array') {
            // Docked chain: collect merged values from all docked nodes
            const chain: any[] = [];

            let currentId: string | null = node.id;
            while (currentId) {
                const currentNode = store.nodes.find(n => n.id === currentId);
                if (!currentNode) break;

                const nodeAssetId = resolveNodeAssetId(currentNode);
                const nodeAsset = nodeAssetId ? store.assets[nodeAssetId] : undefined;

                // Get merged value for this node in the chain
                const nodeOwnValue = (nodeAsset?.value as Record<string, any>) || {};
                const nodeConnectedValue = getConnectedFieldValues(
                    currentNode.id,
                    store.nodes,
                    store.edges,
                    store.assets
                );
                const nodeMergedValue = { ...nodeOwnValue, ...nodeConnectedValue };

                if (Object.keys(nodeMergedValue).length > 0) {
                    chain.unshift(nodeMergedValue);
                }

                currentId = currentNode.data.dockedTo as string | null;
            }

            return {
                type: 'array',
                value: chain,
                meta: { nodeId: node.id, portId }
            };
        }

        if (portId.startsWith('field:')) {
            const fieldKey = portId.replace('field:', '');
            const value = mergedValue[fieldKey];
            if (value !== undefined) {
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
     * Validate if this Form can accept the incoming connection.
     */
    /**
     * Validate if this Form can accept the incoming connection.
     */
    canConnect: (ctx: ConnectionContext): string | null => {
        const { edge, sourcePortValue, targetAsset } = ctx;
        const targetHandle = edge.targetHandle;

        // Output ports don't accept connections
        if (!targetHandle || ['origin', 'output', 'array'].includes(targetHandle)) {
            return null;
        }

        if (!sourcePortValue?.value) {
            return 'Source node has no output data';
        }

        // Get target field definition
        // For FormNode, schema is always in config.schema or asset.schema
        const assetSchema = (targetAsset as any)?.schema || (targetAsset?.config as any)?.schema;
        let targetField: FieldDefinition | undefined;

        if (assetSchema && Array.isArray(assetSchema)) {
            targetField = assetSchema.find((f: FieldDefinition) => f.key === targetHandle);
        }

        if (!targetField) {
            // Strict: Block connection if target field is missing
            return 'Target field definition is missing';
        }

        // Use smartResolve to validate
        // "能提取 = 能连接"
        const error = smartResolveError(sourcePortValue.value, targetField);
        return error;
    },

    /**
     * Handle connections TO this Form node.
     * 
     * NEW: No longer copies data to node storage.
     * Data is resolved dynamically via resolveOutput + useInspector.
     */
    onConnect: (_ctx: ConnectionContext): Record<string, any> | null => {
        // No data copying - Inspector reads connected data dynamically
        return null;
    },
};
