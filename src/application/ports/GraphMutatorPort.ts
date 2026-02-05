import type { SmartNodeSpec } from '@/presentation/engine/GraphMutator';

/**
 * GraphMutatorPort
 *
 * Abstracts graph mutations (node creation, updates)
 * Implementation delegates to graphEngine.mutator
 */
export interface GraphMutatorPort {
    /**
     * Create nodes in batch with smart positioning
     */
    createSmartBatch(specs: SmartNodeSpec[]): void;

    /**
     * Update a node's data
     */
    updateNode(nodeId: string, updates: { data?: Record<string, unknown> }): void;

    /**
     * Update an asset's value
     */
    updateAsset(assetId: string, value: unknown): void;
}
