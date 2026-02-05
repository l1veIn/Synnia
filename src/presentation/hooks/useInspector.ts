/**
 * useInspector - Hook for Inspector panels to read connected field data
 * 
 * This is now a thin wrapper around useFieldConnections for backward compatibility.
 * New code should use useFieldConnections directly.
 */

import { useFieldConnections, resolveFieldConnections } from './useFieldConnections';
import type { ConnectedFieldInfo } from './useFieldConnections';

// Re-export types for backward compatibility
export type { ConnectedFieldInfo };

/**
 * useInspector - Hook for Inspector panels to read connected field data
 * 
 * @deprecated Use useFieldConnections directly for new code
 */
export function useInspector(nodeId: string | undefined) {
    const { connections, isConnected, getConnection } = useFieldConnections(nodeId);

    return {
        connectedFields: connections,
        getConnectedValue: getConnection,
        isFieldConnected: isConnected,
    };
}

/**
 * Utility: Get connected field values as a plain object
 * Used by resolveOutput to merge connected values with own values
 * 
 * @deprecated Use resolveFieldConnections from useFieldConnections instead
 */
export { resolveFieldConnections as getConnectedFieldValues };
