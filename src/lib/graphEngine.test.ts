import { describe, it, expect } from 'vitest';
import { computeNodeHash, hasCycle, evaluateNodeStatus } from './graphEngine';
import { Node, Edge } from '@xyflow/react';
import { AssetData } from '@/types/project';

// Mock Helpers
const createNode = (id: string, data: Partial<AssetData> = {}): Node<AssetData> => ({
    id,
    type: 'Asset',
    position: { x: 0, y: 0 },
    data: {
        assetType: 'test',
        status: 'idle',
        hash: null,
        properties: {},
        provenance: null,
        validationErrors: [],
        ...data
    }
});

const createEdge = (source: string, target: string): Edge => ({
    id: `e-${source}-${target}`,
    source,
    target
});

describe('Graph Engine Logic', () => {

    describe('computeNodeHash', () => {
        it('should be deterministic', () => {
            const data: AssetData = {
                assetType: 'text',
                status: 'idle',
                hash: null,
                properties: { content: 'hello' },
                provenance: null,
                validationErrors: []
            };
            const h1 = computeNodeHash(data);
            const h2 = computeNodeHash(data);
            expect(h1).toBe(h2);
        });

        it('should handle key order independence (JSON stability)', () => {
            const d1 = { properties: { a: 1, b: 2 }, assetType: 'x' } as any;
            const d2 = { properties: { b: 2, a: 1 }, assetType: 'x' } as any;
            
            const h1 = computeNodeHash(d1);
            const h2 = computeNodeHash(d2);
            expect(h1).toBe(h2);
        });

        it('should change hash when content changes', () => {
            const d1 = { properties: { text: 'A' }, assetType: 'x' } as any;
            const d2 = { properties: { text: 'B' }, assetType: 'x' } as any;
            expect(computeNodeHash(d1)).not.toBe(computeNodeHash(d2));
        });

        it('should ignore status and ui fields', () => {
            const d1 = { properties: { a: 1 }, status: 'idle' } as any;
            const d2 = { properties: { a: 1 }, status: 'processing' } as any;
            expect(computeNodeHash(d1)).toBe(computeNodeHash(d2));
        });
    });

    describe('hasCycle (DAG Constraint)', () => {
        const nodes = [
            createNode('A'),
            createNode('B'),
            createNode('C'),
            createNode('D')
        ];

        it('should detect simple cycle A->B->A', () => {
            const edges = [createEdge('A', 'B')];
            const closingEdge = createEdge('B', 'A');
            expect(hasCycle(nodes, edges, closingEdge)).toBe(true);
        });

        it('should detect deep cycle A->B->C->A', () => {
            const edges = [
                createEdge('A', 'B'),
                createEdge('B', 'C')
            ];
            const closingEdge = createEdge('C', 'A');
            expect(hasCycle(nodes, edges, closingEdge)).toBe(true);
        });

        it('should allow branching (diamond shape)', () => {
            // A->B, A->C. Connecting B->D and C->D is fine.
            const edges = [
                createEdge('A', 'B'),
                createEdge('A', 'C'),
                createEdge('B', 'D')
            ];
            const newEdge = createEdge('C', 'D');
            expect(hasCycle(nodes, edges, newEdge)).toBe(false);
        });

        it('should allow self-loop (In-Place Update)', () => {
            const edges: Edge[] = [];
            const selfEdge = createEdge('A', 'A');
            expect(hasCycle(nodes, edges, selfEdge)).toBe(false);
        });
    });

    describe('evaluateNodeStatus (Consistency)', () => {
        const allNodes = [
            createNode('Source', { hash: 'hash-v1' }),
            createNode('Target', { 
                provenance: {
                    recipeId: 'r1',
                    generatedAt: 100,
                    sources: [{ nodeId: 'Source', nodeVersion: 1, nodeHash: 'hash-v1', slot: 'main' }],
                    paramsSnapshot: {}
                }
            })
        ];

        it('should return success when hashes match', () => {
            const status = evaluateNodeStatus(allNodes[1], allNodes);
            expect(status).toBe('success');
        });

        it('should return stale when source hash changes', () => {
            const modifiedNodes = [
                createNode('Source', { hash: 'hash-v2-NEW' }), // Hash changed
                allNodes[1] // Target still thinks parent is hash-v1
            ];
            const status = evaluateNodeStatus(modifiedNodes[1], modifiedNodes);
            expect(status).toBe('stale');
        });

        it('should return error when source is missing (Broken Link)', () => {
            const brokenNodes = [allNodes[1]]; // Source deleted
            const status = evaluateNodeStatus(brokenNodes[0], brokenNodes);
            expect(status).toBe('error');
        });

        it('should stay processing if already processing', () => {
            const processingNode = createNode('P', { status: 'processing' });
            const status = evaluateNodeStatus(processingNode, []);
            expect(status).toBe('processing');
        });
    });

});
