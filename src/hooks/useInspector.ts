import { useMemo } from 'react';
import { useWorkflowStore } from '@/store/workflowStore';
import { behaviorRegistry } from '@core/engine/BehaviorRegistry';

/**
 * Connected field information for Inspector display
 */
export interface ConnectedFieldInfo {
    fieldKey: string;
    sourceNodeId: string;
    sourceNodeTitle: string;
    sourcePortId: string;
    value: any;
}

/**
 * useInspector - Hook for Inspector panels to read connected field data
 * 
 * Responsibilities:
 * - Identify incoming edges to a node
 * - Resolve source port values dynamically
 * - Provide connected field info for display
 */
export function useInspector(nodeId: string | undefined) {
    const nodes = useWorkflowStore(s => s.nodes);
    const edges = useWorkflowStore(s => s.edges);
    const assets = useWorkflowStore(s => s.assets);

    /**
     * Get all connected fields and their resolved values
     */
    const connectedFields = useMemo(() => {
        const result = new Map<string, ConnectedFieldInfo>();
        if (!nodeId) return result;

        // Find all incoming edges to this node
        const incomingEdges = edges.filter(e => e.target === nodeId);

        for (const edge of incomingEdges) {
            // Extract field key from targetHandle
            // Supports both "field:fieldKey" format and direct field key
            const targetHandle = edge.targetHandle;
            if (!targetHandle) continue;

            // Skip semantic handles
            const SEMANTIC_HANDLES = ['origin', 'product', 'output', 'trigger', 'array', 'reference'];
            if (SEMANTIC_HANDLES.includes(targetHandle)) continue;

            // Extract field key: "field:xxx" -> "xxx", or use handle directly
            const fieldKey = targetHandle.startsWith('field:')
                ? targetHandle.slice(6)
                : targetHandle;

            // Get source node info
            const sourceNode = nodes.find(n => n.id === edge.source);
            if (!sourceNode) continue;

            const sourceAsset = sourceNode.data.assetId
                ? assets[sourceNode.data.assetId]
                : null;

            // Resolve source output via behavior
            const behavior = behaviorRegistry.get(sourceNode.type);
            const sourcePortId = edge.sourceHandle || 'output';
            const portValue = behavior.resolveOutput?.(sourceNode, sourceAsset, sourcePortId);

            // Extract the specific field value if port value is an object
            let resolvedValue = portValue?.value;
            if (resolvedValue && typeof resolvedValue === 'object' && !Array.isArray(resolvedValue)) {
                // If source output is an object, try to get the matching field
                resolvedValue = resolvedValue[fieldKey] ?? resolvedValue;
            }

            result.set(fieldKey, {
                fieldKey,
                sourceNodeId: sourceNode.id,
                sourceNodeTitle: sourceNode.data.title || 'Untitled',
                sourcePortId,
                value: resolvedValue,
            });
        }

        return result;
    }, [nodeId, nodes, edges, assets]);

    /**
     * Get connected field value for a specific field key
     */
    const getConnectedValue = (fieldKey: string): ConnectedFieldInfo | undefined => {
        return connectedFields.get(fieldKey);
    };

    /**
     * Check if a field has an incoming connection
     */
    const isFieldConnected = (fieldKey: string): boolean => {
        return connectedFields.has(fieldKey);
    };

    return {
        connectedFields,
        getConnectedValue,
        isFieldConnected,
    };
}

/**
 * Utility: Get connected field values as a plain object
 * Used by resolveOutput to merge connected values with own values
 */
export function getConnectedFieldValues(
    nodeId: string,
    nodes: ReturnType<typeof useWorkflowStore.getState>['nodes'],
    edges: ReturnType<typeof useWorkflowStore.getState>['edges'],
    assets: ReturnType<typeof useWorkflowStore.getState>['assets']
): Record<string, any> {
    const result: Record<string, any> = {};

    const incomingEdges = edges.filter(e => e.target === nodeId);

    for (const edge of incomingEdges) {
        // Extract field key from targetHandle
        // Supports both "field:fieldKey" format and direct field key
        const targetHandle = edge.targetHandle;
        if (!targetHandle) continue;

        // Skip semantic handles
        const SEMANTIC_HANDLES = ['origin', 'product', 'output', 'trigger', 'array', 'reference'];
        if (SEMANTIC_HANDLES.includes(targetHandle)) continue;

        // Extract field key: "field:xxx" -> "xxx", or use handle directly
        const fieldKey = targetHandle.startsWith('field:')
            ? targetHandle.slice(6)
            : targetHandle;

        const sourceNode = nodes.find(n => n.id === edge.source);
        if (!sourceNode) continue;

        const sourceAsset = sourceNode.data.assetId
            ? assets[sourceNode.data.assetId]
            : null;

        const behavior = behaviorRegistry.get(sourceNode.type);
        const sourcePortId = edge.sourceHandle || 'output';
        const portValue = behavior.resolveOutput?.(sourceNode, sourceAsset, sourcePortId);

        let resolvedValue = portValue?.value;
        if (resolvedValue && typeof resolvedValue === 'object' && !Array.isArray(resolvedValue)) {
            resolvedValue = resolvedValue[fieldKey] ?? resolvedValue;
        }

        if (resolvedValue !== undefined) {
            result[fieldKey] = resolvedValue;
        }
    }

    return result;
}
