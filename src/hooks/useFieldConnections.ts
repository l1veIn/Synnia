/**
 * useFieldConnections - Unified hook for field connection resolution
 * 
 * Replaces the duplicated logic in:
 * - useInspector.ts (for Inspector panel display)
 * - getConnectedFieldValues() (for execution)
 * 
 * This hook provides a single source of truth for resolving
 * connected field values, using the FieldCapability system.
 */

import { useMemo } from 'react';
import { useWorkflowStore } from '@/store/workflowStore';
import { behaviorRegistry } from '@core/engine/BehaviorRegistry';
import {
    FieldCapability,
    ConnectionContext,
    PortValue,
    parseFieldKeyFromHandle,
    resolveWithCapability,
    getDefaultCapability,
} from '@core/engine/FieldCapability';
import type { FieldDefinition } from '@/types/assets';
import type { SynniaNode, SynniaEdge } from '@/types/project';
import type { Asset } from '@/types/assets';

// ============================================================================
// Types
// ============================================================================

/**
 * Connected field information for display and execution
 */
export interface ConnectedFieldInfo {
    fieldKey: string;
    sourceNodeId: string;
    sourceNodeTitle: string;
    sourcePortId: string;
    value: any;
    /** Full context for advanced usage */
    context: ConnectionContext;
}

/**
 * Return type of useFieldConnections hook
 */
export interface UseFieldConnectionsReturn {
    /** Map of field key to connection info */
    connections: Map<string, ConnectedFieldInfo>;

    /** Check if a field has an incoming connection */
    isConnected: (fieldKey: string) => boolean;

    /** Get connection info for a specific field */
    getConnection: (fieldKey: string) => ConnectedFieldInfo | undefined;

    /** Get all connected values as a plain object */
    getConnectedValues: () => Record<string, any>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Resolve connections for a node's fields
 * 
 * @param nodeId - Target node ID
 * @param schema - Optional field schema for capability resolution
 * @param getCapability - Optional custom capability resolver
 */
export function useFieldConnections(
    nodeId: string | undefined,
    schema?: FieldDefinition[],
    getCapability?: (field: FieldDefinition) => FieldCapability
): UseFieldConnectionsReturn {
    const nodes = useWorkflowStore(s => s.nodes);
    const edges = useWorkflowStore(s => s.edges);
    const assets = useWorkflowStore(s => s.assets);

    const connections = useMemo(() => {
        const result = new Map<string, ConnectedFieldInfo>();
        if (!nodeId) return result;

        // Find all incoming edges to this node
        const incomingEdges = edges.filter(e => e.target === nodeId);

        for (const edge of incomingEdges) {
            const fieldKey = parseFieldKeyFromHandle(edge.targetHandle);
            if (!fieldKey) continue;

            // Get source node info
            const sourceNode = nodes.find(n => n.id === edge.source);
            if (!sourceNode) continue;

            const sourceAsset = sourceNode.data.assetId
                ? assets[sourceNode.data.assetId]
                : null;

            // Resolve source port value via behavior
            const behavior = behaviorRegistry.get(sourceNode.type);
            const sourcePortId = edge.sourceHandle || 'output';
            const sourcePortValue = behavior.resolveOutput?.(
                sourceNode,
                sourceAsset,
                sourcePortId
            ) as PortValue | null;

            // Build connection context
            const context: ConnectionContext = {
                edge,
                sourceNode,
                sourceAsset,
                sourcePortValue,
                fieldKey,
            };

            // Get capability and resolve value
            const field = schema?.find(f => f.key === fieldKey);
            const capability = field
                ? (getCapability?.(field) ?? getDefaultCapability(field))
                : { hasInputPort: true, hasOutputPort: false };

            const value = resolveWithCapability(capability, context);

            result.set(fieldKey, {
                fieldKey,
                sourceNodeId: sourceNode.id,
                sourceNodeTitle: sourceNode.data.title || 'Untitled',
                sourcePortId,
                value,
                context,
            });
        }

        return result;
    }, [nodeId, nodes, edges, assets, schema, getCapability]);

    // Helper functions
    const isConnected = (fieldKey: string): boolean => {
        return connections.has(fieldKey);
    };

    const getConnection = (fieldKey: string): ConnectedFieldInfo | undefined => {
        return connections.get(fieldKey);
    };

    const getConnectedValues = (): Record<string, any> => {
        const values: Record<string, any> = {};
        connections.forEach((info, key) => {
            if (info.value !== undefined) {
                values[key] = info.value;
            }
        });
        return values;
    };

    return {
        connections,
        isConnected,
        getConnection,
        getConnectedValues,
    };
}

// ============================================================================
// Non-Hook Utility (for execution layer)
// ============================================================================

/**
 * Get connected field values (non-hook version for execution)
 * 
 * This is for use in behavior.resolveOutput and useRunRecipe
 * where React hooks cannot be used.
 */
export function resolveFieldConnections(
    nodeId: string,
    nodes: SynniaNode[],
    edges: SynniaEdge[],
    assets: Record<string, Asset>,
    schema?: FieldDefinition[],
    getCapability?: (field: FieldDefinition) => FieldCapability
): Record<string, any> {
    const result: Record<string, any> = {};

    const incomingEdges = edges.filter(e => e.target === nodeId);

    for (const edge of incomingEdges) {
        const fieldKey = parseFieldKeyFromHandle(edge.targetHandle);
        if (!fieldKey) continue;

        const sourceNode = nodes.find(n => n.id === edge.source);
        if (!sourceNode) continue;

        const sourceAsset = sourceNode.data.assetId
            ? assets[sourceNode.data.assetId]
            : null;

        const behavior = behaviorRegistry.get(sourceNode.type);
        const sourcePortId = edge.sourceHandle || 'output';
        const sourcePortValue = behavior.resolveOutput?.(
            sourceNode,
            sourceAsset,
            sourcePortId
        ) as PortValue | null;

        const context: ConnectionContext = {
            edge,
            sourceNode,
            sourceAsset,
            sourcePortValue,
            fieldKey,
        };

        const field = schema?.find(f => f.key === fieldKey);
        const capability = field
            ? (getCapability?.(field) ?? getDefaultCapability(field))
            : { hasInputPort: true, hasOutputPort: false };

        const value = resolveWithCapability(capability, context);

        if (value !== undefined) {
            result[fieldKey] = value;
        }
    }

    return result;
}
