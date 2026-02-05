/**
 * GraphMutatorAdapter
 *
 * Implements GraphMutatorPort by delegating to graphEngine.
 */

import type { GraphMutatorPort } from '@/application/ports/GraphMutatorPort';
import type { SmartNodeSpec } from '@/presentation/engine/GraphMutator';
import { graphEngine } from '@/presentation/engine/GraphEngine';

export class GraphMutatorAdapter implements GraphMutatorPort {
    createSmartBatch(specs: SmartNodeSpec[]): void {
        graphEngine.mutator.createSmartBatch(specs);
    }

    updateNode(nodeId: string, updates: { data?: Record<string, unknown> }): void {
        graphEngine.updateNode(nodeId, updates);
    }

    updateAsset(assetId: string, value: unknown): void {
        graphEngine.assets.update(assetId, value);
    }
}

// Singleton instance
export const graphMutatorAdapter = new GraphMutatorAdapter();
