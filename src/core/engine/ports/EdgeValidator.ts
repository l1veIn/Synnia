// Edge Validator
// Connection validation logic - delegates to node behaviors via IoC

import { useWorkflowStore } from '@/store/workflowStore';
import { behaviorRegistry } from '@core/engine/BehaviorRegistry';
import type { ConnectionValidation } from './types';
import type { SynniaNode, SynniaEdge } from '@/types/project';
import type { ConnectionContext, EngineContext } from '@core/engine/types/behavior';

// ============================================================================
// Semantic Handle Constants
// ============================================================================

/**
 * Semantic handles that are not field-level inputs
 */
const SEMANTIC_HANDLES = ['origin', 'product', 'output', 'trigger', 'array', 'reference'];

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Check if a handle is a field-level input (not semantic)
 */
export function isFieldLevelInput(handleId: string | null | undefined): boolean {
    if (!handleId) return false;
    if (SEMANTIC_HANDLES.includes(handleId)) return false;
    if (handleId.startsWith('field:')) return false;  // field:xxx are outputs
    return true;
}


/**
 * Validate a connection before creation.
 * Engine handles generic checks (cycle, multi-source).
 * Node-specific validation is delegated to behavior.canConnect.
 */
export function validateConnection(
    connection: {
        source: string;
        target: string;
        sourceHandle?: string | null;
        targetHandle?: string | null;
    }
): ConnectionValidation {
    const { nodes, edges, assets } = useWorkflowStore.getState();

    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);

    if (!sourceNode || !targetNode) {
        return { valid: false, message: 'Node not found' };
    }

    const targetHandle = connection.targetHandle;

    // Semantic handles always allowed (origin, product, etc.)
    if (!isFieldLevelInput(targetHandle)) {
        return { valid: true };
    }

    // Multi-source check: prevent connecting if target handle already has an edge
    const existingEdge = edges.find(e =>
        e.target === connection.target &&
        e.targetHandle === targetHandle
    );
    if (existingEdge) {
        return { valid: false, message: `Field '${targetHandle}' already has a connection` };
    }

    // IoC: Delegate to target node's behavior.canConnect
    const behavior = behaviorRegistry.get(targetNode.type);

    // Strict mode: if no canConnect implemented, reject field-level connections
    if (!behavior.canConnect) {
        return { valid: false, message: `${targetNode.type} does not accept field connections` };
    }

    // Build ConnectionContext
    const sourceAsset = sourceNode.data.assetId ? assets[sourceNode.data.assetId] : null;
    const targetAsset = targetNode.data.assetId ? assets[targetNode.data.assetId] : null;

    const ctx: ConnectionContext = {
        sourceNode,
        targetNode,
        edge: {
            id: `temp-${connection.source}-${connection.target}`,
            source: connection.source,
            target: connection.target,
            sourceHandle: connection.sourceHandle || null,
            targetHandle: connection.targetHandle || null,
        } as SynniaEdge,
        sourceAsset,
        targetAsset,
        getNodes: () => nodes,
        getNode: (id: string) => nodes.find(n => n.id === id),
    };

    const error = behavior.canConnect(ctx);
    if (error) {
        return { valid: false, message: error };
    }

    return { valid: true };
}

/**
 * Check if adding an edge would create a cycle in the graph
 */
export function wouldCreateCycle(
    nodes: SynniaNode[],
    edges: SynniaEdge[],
    newConnection: { source: string; target: string }
): boolean {
    const { source, target } = newConnection;

    // Self-loop detection
    if (source === target) return true;

    // DFS from target to see if we can reach source
    const visited = new Set<string>();
    const stack = [target];

    while (stack.length > 0) {
        const nodeId = stack.pop()!;
        if (nodeId === source) return true;
        if (visited.has(nodeId)) continue;
        visited.add(nodeId);

        // Find all edges where this node is the source
        edges
            .filter(e => e.source === nodeId)
            .forEach(e => stack.push(e.target));
    }

    return false;
}
