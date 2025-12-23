// Edge Validator
// Connection validation logic extracted from InteractionSystem

import { useWorkflowStore } from '@/store/workflowStore';
import { resolvePort } from './PortResolver';
import { isTypeCompatible } from './types';
import type { ConnectionValidation, PortDefinition } from './types';
import type { SynniaNode, SynniaEdge } from '@/types/project';

// ============================================================================
// Semantic Handle Constants
// ============================================================================

/**
 * Semantic handles that are not field-level inputs
 */
const SEMANTIC_HANDLES = ['origin', 'product', 'output', 'trigger', 'array'];

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
 * Check if two ports are type-compatible for connection
 */
export function canConnect(
    sourcePort: PortDefinition | undefined,
    targetPort: PortDefinition | undefined
): boolean {
    if (!sourcePort || !targetPort) return true;  // Allow if ports not registered
    if (sourcePort.direction !== 'output') return false;
    if (targetPort.direction !== 'input') return false;

    return isTypeCompatible(sourcePort.dataType, targetPort.dataType);
}

/**
 * Validate a connection before creation
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

    // Only validate field-level DATA_IN handles
    if (!isFieldLevelInput(targetHandle)) {
        return { valid: true };
    }

    // Check for multi-source: prevent connecting if target handle already has an edge
    const existingEdge = edges.find(e =>
        e.target === connection.target &&
        e.targetHandle === targetHandle
    );
    if (existingEdge) {
        return { valid: false, message: `Field '${targetHandle}' already has a connection` };
    }

    // Get source asset
    const sourceAsset = sourceNode.data.assetId ? assets[sourceNode.data.assetId] : null;

    // Resolve source port value
    const sourcePortId = connection.sourceHandle || 'origin';
    const portValue = resolvePort(sourceNode, sourceAsset, sourcePortId);

    if (!portValue) {
        return { valid: false, message: 'Source node has no output data' };
    }

    // For JSON objects, check if we can provide data for the target
    if (portValue.type === 'json' && typeof portValue.value === 'object' && portValue.value !== null) {
        const keys = Object.keys(portValue.value);

        // If empty object, reject
        if (keys.length === 0) {
            return { valid: false, message: 'Source object is empty' };
        }

        // If target field exists in source, validate it's not empty
        if (keys.includes(targetHandle!)) {
            const fieldValue = portValue.value[targetHandle!];
            if (fieldValue === undefined || fieldValue === null || fieldValue === '') {
                return { valid: false, message: `Field '${targetHandle}' in source is empty` };
            }
        }

        // Note: requiredKeys validation is now handled in UI (FormRenderer)
        // Connections are allowed - users see missing keys in the Inspector panel

        // Allow connection - either field exists or whole object will pass
        return { valid: true };
    }

    // For non-object types, ensure there's some value
    if (portValue.value === undefined || portValue.value === null || portValue.value === '') {
        return { valid: false, message: `Source has no data for field '${targetHandle}'` };
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
