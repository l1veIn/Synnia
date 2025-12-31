// Port Resolver
// Unified data resolution for ports - replaces scattered logic in DataPayload.ts

import { useWorkflowStore } from '@/store/workflowStore';
import { portRegistry } from './PortRegistry';
import type { PortValue } from './types';
import type { SynniaNode, SynniaEdge } from '@/types/project';
import type { Asset } from '@/types/assets';

// ============================================================================
// Core Resolution Functions
// ============================================================================

/**
 * Resolve the value of an output port on a node
 */
export function resolvePort(
    node: SynniaNode,
    asset: Asset | null,
    portId: string
): PortValue | null {
    // Get port definition
    const port = portRegistry.getPort(node, asset, portId);

    if (port && port.direction === 'output' && port.resolver) {
        // Use the registered resolver
        return port.resolver(node, asset);
    }

    // Fallback: try to extract from asset content for field-level ports
    if (portId.startsWith('field:') && asset?.value) {
        const fieldKey = portId.replace('field:', '');
        const content = asset.value as any;

        // Check for values in different content structures
        if (content.values && content.values[fieldKey] !== undefined) {
            return {
                type: typeof content.values[fieldKey] === 'object' ? 'json' : 'text',
                value: content.values[fieldKey],
                meta: { nodeId: node.id, portId }
            };
        }

        // Check direct content access (for text nodes)
        if (content.text !== undefined && fieldKey === 'text') {
            return {
                type: 'text',
                value: content.text,
                meta: { nodeId: node.id, portId }
            };
        }
    }

    // Fallback: return entire asset content for semantic ports
    if (!portId.includes(':') && asset?.value) {
        const content = asset.value as any;

        // For 'origin' or similar, return the whole structure
        if (content.values) {
            return {
                type: 'json',
                value: content.values,
                schema: content.schema,
                meta: { nodeId: node.id, portId }
            };
        }

        if (content.text !== undefined) {
            return {
                type: 'text',
                value: content.text,
                meta: { nodeId: node.id, portId }
            };
        }

        if (content.url !== undefined) {
            return {
                type: 'image',
                value: content.url,
                meta: { nodeId: node.id, portId }
            };
        }
    }

    return null;
}

/**
 * Resolve data flowing through an edge
 */
export function resolveEdge(edge: SynniaEdge): PortValue | null {
    const { nodes, assets } = useWorkflowStore.getState();

    const sourceNode = nodes.find(n => n.id === edge.source);
    if (!sourceNode) return null;

    const asset = sourceNode.data.assetId ? assets[sourceNode.data.assetId] : null;
    const sourcePortId = edge.sourceHandle || 'origin';

    return resolvePort(sourceNode, asset, sourcePortId);
}

/**
 * Resolve the input value for a target field from an edge
 * If source doesn't have the exact field, returns the entire object
 */
export function resolveInputValue(
    portValue: PortValue | null,
    targetFieldKey: string
): any {
    if (!portValue) return undefined;

    // Handle array type (e.g., Selector output)
    // Extract the target field from the first item in the array
    if (portValue.type === 'array' && Array.isArray(portValue.value)) {
        const items = portValue.value;
        if (items.length === 0) return undefined;

        const firstItem = items[0];
        if (firstItem && typeof firstItem === 'object') {
            // Try to get the specific field from first item
            if (targetFieldKey in firstItem) {
                return firstItem[targetFieldKey];
            }

            // Smart field matching: try to find a partial match
            // e.g., targetFieldKey "selectedName" should match source field "name"
            const sourceKeys = Object.keys(firstItem);
            const targetLower = targetFieldKey.toLowerCase();

            // Try to find a source key that the target key ends with or contains
            for (const sourceKey of sourceKeys) {
                const sourceLower = sourceKey.toLowerCase();
                // Check if target ends with source (e.g., "selectedName" ends with "name")
                if (targetLower.endsWith(sourceLower) && sourceLower.length >= 3) {
                    return firstItem[sourceKey];
                }
                // Check if target contains source as a word (e.g., "productType" contains "type")  
                if (targetLower.includes(sourceLower) && sourceLower.length >= 4) {
                    return firstItem[sourceKey];
                }
            }

            // Fallback: return first string field value if target expects a simple value
            for (const sourceKey of sourceKeys) {
                const val = firstItem[sourceKey];
                if (typeof val === 'string' && sourceKey !== 'id') {
                    return val;
                }
            }

            // Return entire first item if no better match found
            return firstItem;
        }
        return firstItem;
    }

    // If source is a JSON object
    if (portValue.type === 'json' && typeof portValue.value === 'object') {
        // Try to get the specific field
        if (portValue.value && targetFieldKey in portValue.value) {
            return portValue.value[targetFieldKey];
        }
        // Otherwise return the entire object
        return portValue.value;
    }

    // For text/image/other types, return as-is
    return portValue.value;
}

// ============================================================================
// Batch Resolution for Recipe Execution
// ============================================================================

/**
 * Collect all input values for a node from connected edges
 */
export function collectInputValues(
    nodeId: string
): Record<string, any> {
    const { nodes, edges, assets } = useWorkflowStore.getState();
    const result: Record<string, any> = {};

    // Find all edges targeting this node
    const incomingEdges = edges.filter(e => e.target === nodeId);

    for (const edge of incomingEdges) {
        const targetFieldKey = edge.targetHandle;
        if (!targetFieldKey) continue;

        const portValue = resolveEdge(edge);
        const value = resolveInputValue(portValue, targetFieldKey);

        if (value !== undefined) {
            result[targetFieldKey] = value;
        }
    }

    return result;
}
