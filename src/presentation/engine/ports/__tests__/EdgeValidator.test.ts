// @ts-nocheck
// Edge Validator Tests
// Tests for edge connection validation and cycle detection

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SynniaNode, SynniaEdge } from '@/presentation/types/project';
import type { Asset } from '@/domain/asset/types';

// Mock the workflowStore
vi.mock('@/store/workflowStore', () => ({
    useWorkflowStore: {
        getState: vi.fn(),
    },
}));

// Mock the behaviorRegistry - factory function returns the mock
vi.mock('@core/engine/BehaviorRegistry', () => {
    const mockBehaviorRegistry = {
        get: vi.fn(),
    };
    return {
        behaviorRegistry: mockBehaviorRegistry,
    };
});

// Import after mocking
import { useWorkflowStore } from '@/store/workflowStore';
import { behaviorRegistry } from '@/presentation/engine/BehaviorRegistry';

import {
    isFieldLevelInput,
    validateConnection,
    wouldCreateCycle,
} from '../EdgeValidator';

// Get reference to the mocked behaviorRegistry for use in tests
const mockBehaviorRegistry = behaviorRegistry as { get: ReturnType<typeof vi.fn> };

describe('isFieldLevelInput', () => {
    it('should return false for null handle', () => {
        expect(isFieldLevelInput(null)).toBe(false);
    });

    it('should return false for undefined handle', () => {
        expect(isFieldLevelInput(undefined)).toBe(false);
    });

    it('should return false for empty string handle', () => {
        expect(isFieldLevelInput('')).toBe(false);
    });

    it('should return false for semantic handles', () => {
        const semanticHandles = ['origin', 'product', 'output', 'trigger', 'array', 'reference'];
        semanticHandles.forEach(handle => {
            expect(isFieldLevelInput(handle)).toBe(false);
        });
    });

    it('should return false for field:xxx handles (outputs)', () => {
        expect(isFieldLevelInput('field:name')).toBe(false);
        expect(isFieldLevelInput('field:email')).toBe(false);
        expect(isFieldLevelInput('field:user_id')).toBe(false);
    });

    it('should return true for field-level inputs', () => {
        expect(isFieldLevelInput('name')).toBe(true);
        expect(isFieldLevelInput('email')).toBe(true);
        expect(isFieldLevelInput('user_id')).toBe(true);
        expect(isFieldLevelInput('prompt')).toBe(true);
    });
});

describe('validateConnection', () => {
    const mockNodes: SynniaNode[] = [
        {
            id: 'node-1',
            type: 'recipe',
            position: { x: 0, y: 0 },
            data: { assetId: 'asset-1', label: 'Source Node' },
        },
        {
            id: 'node-2',
            type: 'llm',
            position: { x: 200, y: 0 },
            data: { assetId: 'asset-2', label: 'Target Node' },
        },
    ];

    const mockEdges: SynniaEdge[] = [
        {
            id: 'edge-1',
            source: 'node-3',
            target: 'node-2',
            targetHandle: 'prompt',
        },
    ];

    const mockAssets: Record<string, Asset> = {
        'asset-1': { id: 'asset-1', name: 'Asset 1', type: 'recipe', schema: [] },
        'asset-2': { id: 'asset-2', name: 'Asset 2', type: 'llm', schema: [] },
    };

    const mockStoreState = {
        nodes: mockNodes,
        edges: mockEdges,
        assets: mockAssets,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (useWorkflowStore.getState as ReturnType<typeof useWorkflowStore.getState>).mockReturnValue(mockStoreState as never);
    });

    describe('node not found', () => {
        it('should return invalid when source node does not exist', () => {
            const result = validateConnection({
                source: 'non-existent',
                target: 'node-2',
                sourceHandle: 'origin',
                targetHandle: 'prompt',
            });

            expect(result).toEqual({ valid: false, message: 'Node not found' });
        });

        it('should return invalid when target node does not exist', () => {
            const result = validateConnection({
                source: 'node-1',
                target: 'non-existent',
                sourceHandle: 'origin',
                targetHandle: 'prompt',
            });

            expect(result).toEqual({ valid: false, message: 'Node not found' });
        });
    });

    describe('semantic handle connections', () => {
        beforeEach(() => {
            mockBehaviorRegistry.get.mockReturnValue({});
        });

        it('should allow connection to origin handle', () => {
            const result = validateConnection({
                source: 'node-1',
                target: 'node-2',
                sourceHandle: 'origin',
                targetHandle: 'origin',
            });

            expect(result).toEqual({ valid: true });
        });

        it('should allow connection to product handle', () => {
            const result = validateConnection({
                source: 'node-1',
                target: 'node-2',
                sourceHandle: 'origin',
                targetHandle: 'product',
            });

            expect(result).toEqual({ valid: true });
        });

        it('should allow connection to output handle', () => {
            const result = validateConnection({
                source: 'node-1',
                target: 'node-2',
                sourceHandle: 'origin',
                targetHandle: 'output',
            });

            expect(result).toEqual({ valid: true });
        });

        it('should allow connection to trigger handle', () => {
            const result = validateConnection({
                source: 'node-1',
                target: 'node-2',
                sourceHandle: 'origin',
                targetHandle: 'trigger',
            });

            expect(result).toEqual({ valid: true });
        });

        it('should allow connection to array handle', () => {
            const result = validateConnection({
                source: 'node-1',
                target: 'node-2',
                sourceHandle: 'origin',
                targetHandle: 'array',
            });

            expect(result).toEqual({ valid: true });
        });

        it('should allow connection to reference handle', () => {
            const result = validateConnection({
                source: 'node-1',
                target: 'node-2',
                sourceHandle: 'origin',
                targetHandle: 'reference',
            });

            expect(result).toEqual({ valid: true });
        });

        it('should allow connection to field:xxx handles', () => {
            const result = validateConnection({
                source: 'node-1',
                target: 'node-2',
                sourceHandle: 'origin',
                targetHandle: 'field:output',
            });

            expect(result).toEqual({ valid: true });
        });

        it('should allow connection when targetHandle is null', () => {
            const result = validateConnection({
                source: 'node-1',
                target: 'node-2',
                sourceHandle: 'origin',
                targetHandle: null,
            });

            expect(result).toEqual({ valid: true });
        });
    });

    describe('multi-source prevention', () => {
        beforeEach(() => {
            mockBehaviorRegistry.get.mockReturnValue({
                canConnect: vi.fn().mockReturnValue(null),
            });
        });

        it('should reject connection when target handle already has an edge', () => {
            const result = validateConnection({
                source: 'node-1',
                target: 'node-2',
                sourceHandle: 'origin',
                targetHandle: 'prompt',
            });

            expect(result).toEqual({
                valid: false,
                message: "Field 'prompt' already has a connection",
            });
        });

        it('should allow connection to different handle on same node', () => {
            const result = validateConnection({
                source: 'node-1',
                target: 'node-2',
                sourceHandle: 'origin',
                targetHandle: 'system', // Different from 'prompt' which has existing edge
            });

            expect(result.valid).toBe(true);
        });
    });

    describe('behavior delegation', () => {
        it('should reject when behavior does not have canConnect method', () => {
            // Mock store with no existing edges
            (useWorkflowStore.getState as unknown as ReturnType<typeof useWorkflowStore.getState>).mockReturnValue({
                ...mockStoreState,
                edges: [],
            });

            mockBehaviorRegistry.get.mockReturnValue({});

            const result = validateConnection({
                source: 'node-1',
                target: 'node-2',
                sourceHandle: 'origin',
                targetHandle: 'prompt',
            });

            expect(result).toEqual({
                valid: false,
                message: 'llm does not accept field connections',
            });
        });

        it('should call behavior.canConnect with correct context', () => {
            // Mock store with no existing edges
            (useWorkflowStore.getState as unknown as ReturnType<typeof useWorkflowStore.getState>).mockReturnValue({
                ...mockStoreState,
                edges: [],
            });

            const canConnectMock = vi.fn().mockReturnValue(null);
            const resolveOutputMock = vi.fn().mockReturnValue({ type: 'text', value: 'test' });

            mockBehaviorRegistry.get.mockImplementation((type: string) => {
                if (type === 'llm') {
                    return {
                        canConnect: canConnectMock,
                    };
                }
                return {
                    resolveOutput: resolveOutputMock,
                };
            });

            const connection = {
                source: 'node-1',
                target: 'node-2',
                sourceHandle: 'output',
                targetHandle: 'prompt',
            };

            validateConnection(connection);

            expect(canConnectMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    sourceNode: mockNodes[0],
                    targetNode: mockNodes[1],
                    edge: expect.objectContaining({
                        source: 'node-1',
                        target: 'node-2',
                        sourceHandle: 'output',
                        targetHandle: 'prompt',
                    }),
                    sourceAsset: mockAssets['asset-1'],
                    targetAsset: mockAssets['asset-2'],
                })
            );
        });

        it('should reject when behavior.canConnect returns error message', () => {
            // Mock store with no existing edges
            (useWorkflowStore.getState as unknown as ReturnType<typeof useWorkflowStore.getState>).mockReturnValue({
                ...mockStoreState,
                edges: [],
            });

            const canConnectMock = vi.fn().mockReturnValue('Incompatible types');

            mockBehaviorRegistry.get.mockReturnValue({
                canConnect: canConnectMock,
                resolveOutput: vi.fn(),
            });

            const result = validateConnection({
                source: 'node-1',
                target: 'node-2',
                sourceHandle: 'origin',
                targetHandle: 'prompt',
            });

            expect(result).toEqual({
                valid: false,
                message: 'Incompatible types',
            });
        });

        it('should accept connection when behavior.canConnect returns null', () => {
            // Mock store with no existing edges
            (useWorkflowStore.getState as unknown as ReturnType<typeof useWorkflowStore.getState>).mockReturnValue({
                ...mockStoreState,
                edges: [],
            });

            const canConnectMock = vi.fn().mockReturnValue(null);

            mockBehaviorRegistry.get.mockReturnValue({
                canConnect: canConnectMock,
                resolveOutput: vi.fn(),
            });

            const result = validateConnection({
                source: 'node-1',
                target: 'node-2',
                sourceHandle: 'origin',
                targetHandle: 'prompt',
            });

            expect(result).toEqual({ valid: true });
        });
    });

    describe('source port value resolution', () => {
        it('should use sourceHandle if provided', () => {
            // Mock store with no existing edges
            (useWorkflowStore.getState as unknown as ReturnType<typeof useWorkflowStore.getState>).mockReturnValue({
                ...mockStoreState,
                edges: [],
            });

            const canConnectMock = vi.fn();
            const resolveOutputMock = vi.fn().mockReturnValue({ type: 'json', value: { data: 'test' } });

            mockBehaviorRegistry.get.mockImplementation((type: string) => {
                if (type === 'llm') {
                    return { canConnect: canConnectMock };
                }
                return { resolveOutput: resolveOutputMock };
            });

            validateConnection({
                source: 'node-1',
                target: 'node-2',
                sourceHandle: 'customOutput',
                targetHandle: 'prompt',
            });

            expect(resolveOutputMock).toHaveBeenCalledWith(mockNodes[0], mockAssets['asset-1'], 'customOutput');
        });

        it('should default to "origin" if sourceHandle is not provided', () => {
            // Mock store with no existing edges
            (useWorkflowStore.getState as unknown as ReturnType<typeof useWorkflowStore.getState>).mockReturnValue({
                ...mockStoreState,
                edges: [],
            });

            const canConnectMock = vi.fn();
            const resolveOutputMock = vi.fn().mockReturnValue(null);

            mockBehaviorRegistry.get.mockImplementation((type: string) => {
                if (type === 'llm') {
                    return { canConnect: canConnectMock };
                }
                return { resolveOutput: resolveOutputMock };
            });

            validateConnection({
                source: 'node-1',
                target: 'node-2',
                targetHandle: 'prompt',
            });

            expect(resolveOutputMock).toHaveBeenCalledWith(mockNodes[0], mockAssets['asset-1'], 'origin');
        });

        it('should pass resolved sourcePortValue to context', () => {
            // Mock store with no existing edges
            (useWorkflowStore.getState as unknown as ReturnType<typeof useWorkflowStore.getState>).mockReturnValue({
                ...mockStoreState,
                edges: [],
            });

            const portValue = { type: 'text', value: 'resolved value' };
            const canConnectMock = vi.fn();
            const resolveOutputMock = vi.fn().mockReturnValue(portValue);

            mockBehaviorRegistry.get.mockImplementation((type: string) => {
                if (type === 'llm') {
                    return { canConnect: canConnectMock };
                }
                return { resolveOutput: resolveOutputMock };
            });

            validateConnection({
                source: 'node-1',
                target: 'node-2',
                sourceHandle: 'output',
                targetHandle: 'prompt',
            });

            expect(canConnectMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    sourcePortValue: portValue,
                })
            );
        });

        it('should handle null resolveOutput result', () => {
            // Mock store with no existing edges
            (useWorkflowStore.getState as unknown as ReturnType<typeof useWorkflowStore.getState>).mockReturnValue({
                ...mockStoreState,
                edges: [],
            });

            const canConnectMock = vi.fn();
            const resolveOutputMock = vi.fn().mockReturnValue(null);

            mockBehaviorRegistry.get.mockImplementation((type: string) => {
                if (type === 'llm') {
                    return { canConnect: canConnectMock };
                }
                return { resolveOutput: resolveOutputMock };
            });

            validateConnection({
                source: 'node-1',
                target: 'node-2',
                sourceHandle: 'output',
                targetHandle: 'prompt',
            });

            expect(canConnectMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    sourcePortValue: null,
                })
            );
        });
    });

    describe('asset resolution', () => {
        it('should resolve sourceAsset when assetId exists', () => {
            // Mock store with no existing edges
            (useWorkflowStore.getState as unknown as ReturnType<typeof useWorkflowStore.getState>).mockReturnValue({
                ...mockStoreState,
                edges: [],
            });

            const canConnectMock = vi.fn();

            mockBehaviorRegistry.get.mockReturnValue({
                canConnect: canConnectMock,
                resolveOutput: vi.fn(),
            });

            validateConnection({
                source: 'node-1',
                target: 'node-2',
                sourceHandle: 'origin',
                targetHandle: 'prompt',
            });

            expect(canConnectMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    sourceAsset: mockAssets['asset-1'],
                })
            );
        });

        it('should resolve targetAsset when assetId exists', () => {
            // Mock store with no existing edges
            (useWorkflowStore.getState as unknown as ReturnType<typeof useWorkflowStore.getState>).mockReturnValue({
                ...mockStoreState,
                edges: [],
            });

            const canConnectMock = vi.fn();

            mockBehaviorRegistry.get.mockReturnValue({
                canConnect: canConnectMock,
                resolveOutput: vi.fn(),
            });

            validateConnection({
                source: 'node-1',
                target: 'node-2',
                sourceHandle: 'origin',
                targetHandle: 'prompt',
            });

            expect(canConnectMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    targetAsset: mockAssets['asset-2'],
                })
            );
        });

        it('should handle null sourceAsset when assetId does not exist', () => {
            // Mock store with no existing edges and node without assetId
            const nodesWithoutAsset: SynniaNode[] = [
                {
                    id: 'node-1',
                    type: 'recipe',
                    position: { x: 0, y: 0 },
                    data: { label: 'Source Node' }, // No assetId
                },
                ...mockNodes.slice(1),
            ];

            (useWorkflowStore.getState as unknown as ReturnType<typeof useWorkflowStore.getState>).mockReturnValue({
                ...mockStoreState,
                nodes: nodesWithoutAsset,
                edges: [],
            });

            const canConnectMock = vi.fn();

            mockBehaviorRegistry.get.mockReturnValue({
                canConnect: canConnectMock,
                resolveOutput: vi.fn(),
            });

            validateConnection({
                source: 'node-1',
                target: 'node-2',
                sourceHandle: 'origin',
                targetHandle: 'prompt',
            });

            expect(canConnectMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    sourceAsset: null,
                })
            );
        });
    });

    describe('ConnectionContext helpers', () => {
        it('should provide getNodes helper', () => {
            // Mock store with no existing edges
            (useWorkflowStore.getState as unknown as ReturnType<typeof useWorkflowStore.getState>).mockReturnValue({
                ...mockStoreState,
                edges: [],
            });

            const canConnectMock = vi.fn();

            mockBehaviorRegistry.get.mockReturnValue({
                canConnect: canConnectMock,
                resolveOutput: vi.fn(),
            });

            validateConnection({
                source: 'node-1',
                target: 'node-2',
                sourceHandle: 'origin',
                targetHandle: 'prompt',
            });

            const context = canConnectMock.mock.calls[0][0];
            expect(typeof context.getNodes).toBe('function');
            expect(context.getNodes()).toEqual(mockNodes);
        });

        it('should provide getNode helper', () => {
            // Mock store with no existing edges
            (useWorkflowStore.getState as unknown as ReturnType<typeof useWorkflowStore.getState>).mockReturnValue({
                ...mockStoreState,
                edges: [],
            });

            const canConnectMock = vi.fn();

            mockBehaviorRegistry.get.mockReturnValue({
                canConnect: canConnectMock,
                resolveOutput: vi.fn(),
            });

            validateConnection({
                source: 'node-1',
                target: 'node-2',
                sourceHandle: 'origin',
                targetHandle: 'prompt',
            });

            const context = canConnectMock.mock.calls[0][0];
            expect(typeof context.getNode).toBe('function');
            expect(context.getNode('node-1')).toEqual(mockNodes[0]);
            expect(context.getNode('non-existent')).toBeUndefined();
        });
    });
});

describe('wouldCreateCycle', () => {
    const mockNodes: SynniaNode[] = [
        { id: 'node-1', type: 'recipe', position: { x: 0, y: 0 }, data: {} },
        { id: 'node-2', type: 'llm', position: { x: 200, y: 0 }, data: {} },
        { id: 'node-3', type: 'output', position: { x: 400, y: 0 }, data: {} },
    ];

    describe('self-loop detection', () => {
        it('should return true for self-loop (same source and target)', () => {
            const result = wouldCreateCycle(mockNodes, [], {
                source: 'node-1',
                target: 'node-1',
            });

            expect(result).toBe(true);
        });
    });

    describe('cycle detection with existing edges', () => {
        const mockEdges: SynniaEdge[] = [
            { id: 'edge-1', source: 'node-1', target: 'node-2' },
            { id: 'edge-2', source: 'node-2', target: 'node-3' },
        ];

        it('should return false when no cycle would be created', () => {
            const result = wouldCreateCycle(mockNodes, mockEdges, {
                source: 'node-1',
                target: 'node-3',
            });

            expect(result).toBe(false);
        });

        it('should return true when connecting node-3 to node-1 would create cycle', () => {
            // Current flow: node-1 -> node-2 -> node-3
            // Connecting node-3 -> node-1 would create: node-1 -> node-2 -> node-3 -> node-1
            const result = wouldCreateCycle(mockNodes, mockEdges, {
                source: 'node-3',
                target: 'node-1',
            });

            expect(result).toBe(true);
        });

        it('should return true when connecting node-3 to node-2 would create cycle', () => {
            // Current flow: node-1 -> node-2 -> node-3
            // Connecting node-3 -> node-2 would create: node-2 -> node-3 -> node-2
            const result = wouldCreateCycle(mockNodes, mockEdges, {
                source: 'node-3',
                target: 'node-2',
            });

            expect(result).toBe(true);
        });

        it('should return false when adding to leaf node', () => {
            const newLeafNode: SynniaNode = { id: 'node-4', type: 'output', position: { x: 600, y: 0 }, data: {} };
            const result = wouldCreateCycle([...mockNodes, newLeafNode], mockEdges, {
                source: 'node-3',
                target: 'node-4',
            });

            expect(result).toBe(false);
        });
    });

    describe('complex graph scenarios', () => {
        it('should detect cycle in branching graph', () => {
            const nodes: SynniaNode[] = [
                { id: 'a', type: 'recipe', position: { x: 0, y: 0 }, data: {} },
                { id: 'b', type: 'llm', position: { x: 100, y: 0 }, data: {} },
                { id: 'c', type: 'output', position: { x: 200, y: 0 }, data: {} },
                { id: 'd', type: 'output', position: { x: 200, y: 100 }, data: {} },
            ];

            const edges: SynniaEdge[] = [
                { id: 'e1', source: 'a', target: 'b' },
                { id: 'e2', source: 'b', target: 'c' },
                { id: 'e3', source: 'b', target: 'd' },
            ];

            // Connecting d -> a would create: a -> b -> d -> a
            const result = wouldCreateCycle(nodes, edges, {
                source: 'd',
                target: 'a',
            });

            expect(result).toBe(true);
        });

        it('should handle disconnected components', () => {
            const nodes: SynniaNode[] = [
                { id: 'component1-a', type: 'recipe', position: { x: 0, y: 0 }, data: {} },
                { id: 'component1-b', type: 'llm', position: { x: 100, y: 0 }, data: {} },
                { id: 'component2-a', type: 'recipe', position: { x: 200, y: 200 }, data: {} },
                { id: 'component2-b', type: 'llm', position: { x: 300, y: 200 }, data: {} },
            ];

            const edges: SynniaEdge[] = [
                { id: 'e1', source: 'component1-a', target: 'component1-b' },
                { id: 'e2', source: 'component2-a', target: 'component2-b' },
            ];

            // Connecting components should not create cycle
            const result = wouldCreateCycle(nodes, edges, {
                source: 'component1-b',
                target: 'component2-a',
            });

            expect(result).toBe(false);
        });

        it('should handle empty graph', () => {
            const result = wouldCreateCycle([], [], {
                source: 'node-1',
                target: 'node-2',
            });

            expect(result).toBe(false);
        });
    });

    describe('DFS traversal correctness', () => {
        it('should correctly traverse all edges from target', () => {
            const nodes: SynniaNode[] = [
                { id: 'start', type: 'recipe', position: { x: 0, y: 0 }, data: {} },
                { id: 'middle', type: 'llm', position: { x: 100, y: 0 }, data: {} },
                { id: 'end1', type: 'output', position: { x: 200, y: 0 }, data: {} },
                { id: 'end2', type: 'output', position: { x: 200, y: 100 }, data: {} },
            ];

            const edges: SynniaEdge[] = [
                { id: 'e1', source: 'start', target: 'middle' },
                { id: 'e2', source: 'middle', target: 'end1' },
                { id: 'e3', source: 'middle', target: 'end2' },
                { id: 'e4', source: 'end2', target: 'end1' },
            ];

            // Connecting end1 -> start creates: start -> middle -> end2 -> end1 -> start
            // DFS from end1: end1 has no outgoing edges, so no cycle... wait, let me fix this
            // The edge is end2 -> end1, not end1 -> end2
            // So connecting end1 -> start would create a cycle if there was a path from end1 to start
            // But end1 has no outgoing edges, so this should NOT create a cycle
            const result = wouldCreateCycle(nodes, edges, {
                source: 'start',
                target: 'end1',
            });

            expect(result).toBe(false);
        });

        it('should detect cycle through multiple outgoing edges', () => {
            const nodes: SynniaNode[] = [
                { id: 'a', type: 'recipe', position: { x: 0, y: 0 }, data: {} },
                { id: 'b', type: 'llm', position: { x: 100, y: 0 }, data: {} },
                { id: 'c', type: 'output', position: { x: 200, y: 0 }, data: {} },
                { id: 'd', type: 'output', position: { x: 200, y: 100 }, data: {} },
            ];

            const edges: SynniaEdge[] = [
                { id: 'e1', source: 'a', target: 'b' },
                { id: 'e2', source: 'b', target: 'c' },
                { id: 'e3', source: 'b', target: 'd' },
                { id: 'e4', source: 'c', target: 'a' },
            ];

            // Connecting d -> a: DFS from d goes nowhere (d has no outgoing edges)
            // But wait, we need to test that the DFS actually checks all paths from b
            const result = wouldCreateCycle(nodes, edges, {
                source: 'a',
                target: 'b',
            });

            // b -> c -> a creates a cycle
            expect(result).toBe(true);
        });

        it('should handle diamond pattern correctly', () => {
            const nodes: SynniaNode[] = [
                { id: 'a', type: 'recipe', position: { x: 0, y: 0 }, data: {} },
                { id: 'b', type: 'llm', position: { x: 100, y: 0 }, data: {} },
                { id: 'c', type: 'output', position: { x: 200, y: -50 }, data: {} },
                { id: 'd', type: 'output', position: { x: 200, y: 50 }, data: {} },
            ];

            const edges: SynniaEdge[] = [
                { id: 'e1', source: 'a', target: 'b' },
                { id: 'e2', source: 'b', target: 'c' },
                { id: 'e3', source: 'b', target: 'd' },
                { id: 'e4', source: 'c', target: 'a' },
                { id: 'e5', source: 'd', target: 'a' },
            ];

            // Connecting a -> b: DFS from b checks both paths to c and d
            // Both c -> a and d -> a, so cycle detected
            const result = wouldCreateCycle(nodes, edges, {
                source: 'a',
                target: 'b',
            });

            expect(result).toBe(true);
        });
    });
});
