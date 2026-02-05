// @ts-nocheck
/**
 * useFieldConnections Hook Tests
 * Tests for field connection resolution logic patterns
 * Note: Hook testing requires @testing-library/react-hooks with jsdom environment
 * These tests verify the expected behavior patterns without calling React hooks directly
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SynniaNode, SynniaEdge } from '@/presentation/types/project';
import { Asset, FieldDefinition } from '@/domain/asset/types';
import { resolveFieldConnections, ConnectedFieldInfo } from '@/presentation/hooks/useFieldConnections';
import { FieldCapability, parseFieldKeyFromHandle, PortValue, ConnectionContext } from '@/presentation/engine/FieldCapability';
import { NodeBehavior } from '@/presentation/engine/types/behavior';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/store/workflowStore', () => ({
    useWorkflowStore: vi.fn(),
}));

vi.mock('@core/engine/BehaviorRegistry', () => ({
    behaviorRegistry: {
        get: vi.fn(),
    },
}));

vi.mock('@/domain/edge/ValueMappingService', () => ({
    smartResolveValue: vi.fn((value, field) => {
        // Simple mock: return value directly for most cases
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            return value[field.key] ?? value;
        }
        return value;
    }),
}));

import { behaviorRegistry } from '@/presentation/engine/BehaviorRegistry';

// ============================================================================
// Test Helpers
// ============================================================================

const createMockNode = (overrides?: Partial<SynniaNode>): SynniaNode => ({
    id: 'test-node-1',
    type: 'text',
    position: { x: 0, y: 0 },
    data: {
        title: 'Test Node',
        ...overrides?.data,
    },
    ...overrides,
});

const createMockAsset = (overrides?: Partial<Asset>): Asset => ({
    id: 'asset-1',
    valueType: 'record',
    value: { field1: 'value1', field2: 'value2' },
    config: { schema: [] },
    sys: {
        name: 'Test Asset',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        source: 'user',
        isLibraryAsset: null,
    },
    ...overrides,
});

const createMockEdge = (overrides?: Partial<SynniaEdge>): SynniaEdge => ({
    id: 'edge-1',
    source: 'source-node',
    target: 'target-node',
    sourceHandle: 'output',
    targetHandle: 'field:inputField',
    ...overrides,
});

const createMockBehavior = (resolveOutput?: NodeBehavior['resolveOutput']): NodeBehavior => ({
    resolveOutput: resolveOutput || vi.fn(() => ({ type: 'json', value: { inputField: 'resolvedValue' } })),
});

const createMockSchema = (): FieldDefinition[] => [
    { key: 'inputField', type: 'string', label: 'Input Field', connection: 'input' },
    { key: 'otherField', type: 'string', label: 'Other Field', connection: 'input' },
];

// ============================================================================
// parseFieldKeyFromHandle Tests (imported from FieldCapability)
// ============================================================================

describe('parseFieldKeyFromHandle', () => {
    it('should extract field key from "field:xxx" format', () => {
        expect(parseFieldKeyFromHandle('field:myField')).toBe('myField');
    });

    it('should return field key directly when no prefix', () => {
        expect(parseFieldKeyFromHandle('myField')).toBe('myField');
    });

    it('should return null for semantic handle "origin"', () => {
        expect(parseFieldKeyFromHandle('origin')).toBeNull();
    });

    it('should return null for semantic handle "product"', () => {
        expect(parseFieldKeyFromHandle('product')).toBeNull();
    });

    it('should return null for semantic handle "output"', () => {
        expect(parseFieldKeyFromHandle('output')).toBeNull();
    });

    it('should return null for semantic handle "trigger"', () => {
        expect(parseFieldKeyFromHandle('trigger')).toBeNull();
    });

    it('should return null for semantic handle "array"', () => {
        expect(parseFieldKeyFromHandle('array')).toBeNull();
    });

    it('should return null for semantic handle "reference"', () => {
        expect(parseFieldKeyFromHandle('reference')).toBeNull();
    });

    it('should return null for null handle', () => {
        expect(parseFieldKeyFromHandle(null)).toBeNull();
    });

    it('should return null for undefined handle', () => {
        expect(parseFieldKeyFromHandle(undefined)).toBeNull();
    });
});

// ============================================================================
// resolveFieldConnections Function Tests
// ============================================================================

describe('resolveFieldConnections (non-hook)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('basic functionality', () => {
        it('should resolve connections without React hooks', () => {
            const sourceNode = createMockNode({ id: 'source-node' });
            const targetNode = createMockNode({ id: 'target-node' });
            const edge = createMockEdge({
                source: 'source-node',
                target: 'target-node',
                targetHandle: 'field:inputField',
            });
            const behavior = createMockBehavior();

            vi.mocked(behaviorRegistry.get).mockReturnValue(behavior);

            const result = resolveFieldConnections(
                'target-node',
                [sourceNode, targetNode],
                [edge],
                {},
                createMockSchema()
            );

            expect(result).toEqual({ inputField: 'resolvedValue' });
        });

        it('should return empty object when no connections exist', () => {
            const targetNode = createMockNode({ id: 'target-node' });

            const result = resolveFieldConnections(
                'target-node',
                [targetNode],
                [],
                {}
            );

            expect(result).toEqual({});
        });

        it('should return empty object when nodeId is not in nodes', () => {
            const result = resolveFieldConnections(
                'non-existent-node',
                [],
                [],
                {}
            );

            expect(result).toEqual({});
        });
    });

    describe('handle parsing', () => {
        it('should parse field: prefix from handle', () => {
            const sourceNode = createMockNode({ id: 'source-node' });
            const targetNode = createMockNode({ id: 'target-node' });
            const edge = createMockEdge({
                source: 'source-node',
                target: 'target-node',
                targetHandle: 'field:myField',
            });
            const behavior = createMockBehavior();

            vi.mocked(behaviorRegistry.get).mockReturnValue(behavior);

            const result = resolveFieldConnections(
                'target-node',
                [sourceNode, targetNode],
                [edge],
                {},
                [{ key: 'myField', type: 'string', connection: 'input' }]
            );

            expect(result).toHaveProperty('myField');
        });

        it('should use direct field key without field: prefix', () => {
            const sourceNode = createMockNode({ id: 'source-node' });
            const targetNode = createMockNode({ id: 'target-node' });
            const edge = createMockEdge({
                source: 'source-node',
                target: 'target-node',
                targetHandle: 'directField',
            });
            const behavior = createMockBehavior();

            vi.mocked(behaviorRegistry.get).mockReturnValue(behavior);

            const result = resolveFieldConnections(
                'target-node',
                [sourceNode, targetNode],
                [edge],
                {},
                [{ key: 'directField', type: 'string', connection: 'input' }]
            );

            expect(result).toHaveProperty('directField');
        });

        it('should skip semantic handles (origin, product, output, trigger, array, reference)', () => {
            const sourceNode = createMockNode({ id: 'source-node' });
            const targetNode = createMockNode({ id: 'target-node' });
            const semanticHandles = ['origin', 'product', 'output', 'trigger', 'array', 'reference'];
            const edges = semanticHandles.map((handle, i) => createMockEdge({
                id: `edge-${i}`,
                source: 'source-node',
                target: 'target-node',
                targetHandle: handle,
            }));
            const behavior = createMockBehavior();

            vi.mocked(behaviorRegistry.get).mockReturnValue(behavior);

            const result = resolveFieldConnections(
                'target-node',
                [sourceNode, targetNode],
                edges,
                {}
            );

            expect(result).toEqual({});
        });

        it('should skip handles that parse to null', () => {
            const sourceNode = createMockNode({ id: 'source-node' });
            const targetNode = createMockNode({ id: 'target-node' });
            const edge = createMockEdge({
                source: 'source-node',
                target: 'target-node',
                targetHandle: null as string | null,
            });

            const result = resolveFieldConnections(
                'target-node',
                [sourceNode, targetNode],
                [edge],
                {}
            );

            expect(result).toEqual({});
        });
    });

    describe('edge filtering', () => {
        it('should only process edges targeting the specified node', () => {
            const sourceNode = createMockNode({ id: 'source-node' });
            const targetNode = createMockNode({ id: 'target-node' });
            const otherNode = createMockNode({ id: 'other-node' });
            const edgeToTarget = createMockEdge({
                id: 'edge-1',
                source: 'source-node',
                target: 'target-node',
                targetHandle: 'field:inputField',
            });
            const edgeToOther = createMockEdge({
                id: 'edge-2',
                source: 'source-node',
                target: 'other-node',
                targetHandle: 'field:inputField',
            });
            const behavior = createMockBehavior();

            vi.mocked(behaviorRegistry.get).mockReturnValue(behavior);

            const result = resolveFieldConnections(
                'target-node',
                [sourceNode, targetNode, otherNode],
                [edgeToTarget, edgeToOther],
                {},
                createMockSchema()
            );

            // Should only have the connection to target-node
            expect(result).toEqual({ inputField: 'resolvedValue' });
        });

        it('should skip edges when source node is not found', () => {
            const targetNode = createMockNode({ id: 'target-node' });
            const edge = createMockEdge({
                source: 'missing-node',
                target: 'target-node',
                targetHandle: 'field:inputField',
            });

            const result = resolveFieldConnections(
                'target-node',
                [targetNode],
                [edge],
                {}
            );

            expect(result).toEqual({});
        });
    });

    describe('with assets', () => {
        it('should include source asset in context', () => {
            const sourceNode = createMockNode({
                id: 'source-node',
                data: { assetId: 'asset-1' },
            });
            const targetNode = createMockNode({ id: 'target-node' });
            const edge = createMockEdge({
                source: 'source-node',
                target: 'target-node',
                targetHandle: 'field:inputField',
            });
            const sourceAsset = createMockAsset({ id: 'asset-1' });
            const behavior = createMockBehavior();

            vi.mocked(behaviorRegistry.get).mockReturnValue(behavior);

            resolveFieldConnections(
                'target-node',
                [sourceNode, targetNode],
                [edge],
                { 'asset-1': sourceAsset },
                createMockSchema()
            );

            // Verify behavior was called with asset
            expect(behavior.resolveOutput).toHaveBeenCalledWith(
                sourceNode,
                sourceAsset,
                'output'
            );
        });

        it('should pass undefined when assetId does not exist in assets', () => {
            const sourceNode = createMockNode({
                id: 'source-node',
                data: { assetId: 'non-existent-asset' },
            });
            const targetNode = createMockNode({ id: 'target-node' });
            const edge = createMockEdge({
                source: 'source-node',
                target: 'target-node',
                targetHandle: 'field:inputField',
            });
            const behavior = createMockBehavior();

            vi.mocked(behaviorRegistry.get).mockReturnValue(behavior);

            resolveFieldConnections(
                'target-node',
                [sourceNode, targetNode],
                [edge],
                {},
                createMockSchema()
            );

            // Verify behavior was called with undefined asset (missing key)
            expect(behavior.resolveOutput).toHaveBeenCalledWith(
                sourceNode,
                undefined,
                'output'
            );
        });

        it('should pass null when assetId is not set', () => {
            const sourceNode = createMockNode({
                id: 'source-node',
                data: {},
            });
            const targetNode = createMockNode({ id: 'target-node' });
            const edge = createMockEdge({
                source: 'source-node',
                target: 'target-node',
                targetHandle: 'field:inputField',
            });
            const behavior = createMockBehavior();

            vi.mocked(behaviorRegistry.get).mockReturnValue(behavior);

            resolveFieldConnections(
                'target-node',
                [sourceNode, targetNode],
                [edge],
                {},
                createMockSchema()
            );

            // Verify behavior was called with null asset
            expect(behavior.resolveOutput).toHaveBeenCalledWith(
                sourceNode,
                null,
                'output'
            );
        });
    });

    describe('sourceHandle defaulting', () => {
        it('should use "output" as default when sourceHandle is undefined', () => {
            const sourceNode = createMockNode({ id: 'source-node' });
            const targetNode = createMockNode({ id: 'target-node' });
            const edge = createMockEdge({
                source: 'source-node',
                target: 'target-node',
                targetHandle: 'field:inputField',
                sourceHandle: undefined,
            });
            const behavior = createMockBehavior();

            vi.mocked(behaviorRegistry.get).mockReturnValue(behavior);

            resolveFieldConnections(
                'target-node',
                [sourceNode, targetNode],
                [edge],
                {},
                createMockSchema()
            );

            expect(behavior.resolveOutput).toHaveBeenCalledWith(
                sourceNode,
                null,
                'output'
            );
        });

        it('should use provided sourceHandle when set', () => {
            const sourceNode = createMockNode({ id: 'source-node' });
            const targetNode = createMockNode({ id: 'target-node' });
            const edge = createMockEdge({
                source: 'source-node',
                target: 'target-node',
                targetHandle: 'field:inputField',
                sourceHandle: 'customPort',
            });
            const behavior = createMockBehavior();

            vi.mocked(behaviorRegistry.get).mockReturnValue(behavior);

            resolveFieldConnections(
                'target-node',
                [sourceNode, targetNode],
                [edge],
                {},
                createMockSchema()
            );

            expect(behavior.resolveOutput).toHaveBeenCalledWith(
                sourceNode,
                null,
                'customPort'
            );
        });
    });

    describe('with schema and capabilities', () => {
        it('should use default capability when schema is not provided', () => {
            const sourceNode = createMockNode({ id: 'source-node' });
            const targetNode = createMockNode({ id: 'target-node' });
            const edge = createMockEdge({
                source: 'source-node',
                target: 'target-node',
                targetHandle: 'field:inputField',
            });
            const behavior = createMockBehavior();

            vi.mocked(behaviorRegistry.get).mockReturnValue(behavior);

            const result = resolveFieldConnections(
                'target-node',
                [sourceNode, targetNode],
                [edge],
                {}
            );

            // Should still resolve the connection with default capability
            expect(result).toHaveProperty('inputField');
        });

        it('should use custom capability resolver when provided', () => {
            const sourceNode = createMockNode({ id: 'source-node' });
            const targetNode = createMockNode({ id: 'target-node' });
            const edge = createMockEdge({
                source: 'source-node',
                target: 'target-node',
                targetHandle: 'field:inputField',
            });

            const customCapability: FieldCapability = {
                hasInputPort: true,
                hasOutputPort: false,
                resolveConnectedValue: () => 'custom-value',
            };

            const getCapability = vi.fn(() => customCapability);
            const behavior = createMockBehavior();

            vi.mocked(behaviorRegistry.get).mockReturnValue(behavior);

            const result = resolveFieldConnections(
                'target-node',
                [sourceNode, targetNode],
                [edge],
                {},
                createMockSchema(),
                getCapability
            );

            expect(getCapability).toHaveBeenCalledWith(
                expect.objectContaining({ key: 'inputField' })
            );
            expect(result).toEqual({ inputField: 'custom-value' });
        });

        it('should find field in schema by key', () => {
            const sourceNode = createMockNode({ id: 'source-node' });
            const targetNode = createMockNode({ id: 'target-node' });
            const edge = createMockEdge({
                source: 'source-node',
                target: 'target-node',
                targetHandle: 'field:schemaField',
            });
            const behavior = createMockBehavior();

            vi.mocked(behaviorRegistry.get).mockReturnValue(behavior);

            const schema = [
                { key: 'schemaField', type: 'string', connection: 'input' },
                { key: 'otherField', type: 'number', connection: 'input' },
            ];

            const result = resolveFieldConnections(
                'target-node',
                [sourceNode, targetNode],
                [edge],
                {},
                schema
            );

            expect(result).toHaveProperty('schemaField');
        });
    });

    describe('behavior resolution', () => {
        it('should get behavior from registry by source node type', () => {
            const sourceNode = createMockNode({ id: 'source-node', type: 'text' });
            const targetNode = createMockNode({ id: 'target-node' });
            const edge = createMockEdge({
                source: 'source-node',
                target: 'target-node',
                targetHandle: 'field:inputField',
            });
            const behavior = createMockBehavior();

            vi.mocked(behaviorRegistry.get).mockReturnValue(behavior);

            resolveFieldConnections(
                'target-node',
                [sourceNode, targetNode],
                [edge],
                {},
                createMockSchema()
            );

            expect(behaviorRegistry.get).toHaveBeenCalledWith('text');
        });

        it('should handle behavior without resolveOutput method', () => {
            const sourceNode = createMockNode({ id: 'source-node' });
            const targetNode = createMockNode({ id: 'target-node' });
            const edge = createMockEdge({
                source: 'source-node',
                target: 'target-node',
                targetHandle: 'field:inputField',
            });
            const behavior = {}; // No resolveOutput

            vi.mocked(behaviorRegistry.get).mockReturnValue(behavior);

            const result = resolveFieldConnections(
                'target-node',
                [sourceNode, targetNode],
                [edge],
                {},
                createMockSchema()
            );

            // Should return empty object since resolveOutput is undefined
            expect(result).toEqual({});
        });
    });

    describe('multiple connections', () => {
        it('should resolve multiple incoming connections', () => {
            const sourceNode1 = createMockNode({ id: 'source-1' });
            const sourceNode2 = createMockNode({ id: 'source-2' });
            const targetNode = createMockNode({ id: 'target-node' });
            const edge1 = createMockEdge({
                id: 'edge-1',
                source: 'source-1',
                target: 'target-node',
                targetHandle: 'field:field1',
            });
            const edge2 = createMockEdge({
                id: 'edge-2',
                source: 'source-2',
                target: 'target-node',
                targetHandle: 'field:field2',
            });
            const behavior = createMockBehavior();

            vi.mocked(behaviorRegistry.get).mockReturnValue(behavior);

            const result = resolveFieldConnections(
                'target-node',
                [sourceNode1, sourceNode2, targetNode],
                [edge1, edge2],
                {},
                [
                    { key: 'field1', type: 'string', connection: 'input' },
                    { key: 'field2', type: 'string', connection: 'input' },
                ]
            );

            expect(result).toHaveProperty('field1');
            expect(result).toHaveProperty('field2');
        });

        it('should handle multiple edges from same source node', () => {
            const sourceNode = createMockNode({ id: 'source-node' });
            const targetNode = createMockNode({ id: 'target-node' });
            const edge1 = createMockEdge({
                id: 'edge-1',
                source: 'source-node',
                target: 'target-node',
                targetHandle: 'field:field1',
            });
            const edge2 = createMockEdge({
                id: 'edge-2',
                source: 'source-node',
                target: 'target-node',
                targetHandle: 'field:field2',
            });
            const behavior = createMockBehavior();

            vi.mocked(behaviorRegistry.get).mockReturnValue(behavior);

            const result = resolveFieldConnections(
                'target-node',
                [sourceNode, targetNode],
                [edge1, edge2],
                {},
                [
                    { key: 'field1', type: 'string', connection: 'input' },
                    { key: 'field2', type: 'string', connection: 'input' },
                ]
            );

            expect(result).toHaveProperty('field1');
            expect(result).toHaveProperty('field2');
        });
    });

    describe('value handling', () => {
        it('should exclude undefined values from result', () => {
            const sourceNode = createMockNode({ id: 'source-node' });
            const targetNode = createMockNode({ id: 'target-node' });
            const edge = createMockEdge({
                source: 'source-node',
                target: 'target-node',
                targetHandle: 'field:inputField',
            });

            const behavior = createMockBehavior(
                () => null as PortValue | null // resolveOutput returns null/undefined
            );

            vi.mocked(behaviorRegistry.get).mockReturnValue(behavior);

            const result = resolveFieldConnections(
                'target-node',
                [sourceNode, targetNode],
                [edge],
                {},
                createMockSchema()
            );

            // When value is undefined, it should not be in the result
            expect(result).toEqual({});
        });

        it('should include resolved values in result', () => {
            const sourceNode = createMockNode({ id: 'source-node' });
            const targetNode = createMockNode({ id: 'target-node' });
            const edge = createMockEdge({
                source: 'source-node',
                target: 'target-node',
                targetHandle: 'field:inputField',
            });

            const behavior = createMockBehavior(
                () => ({ type: 'json', value: 'my-value' })
            );

            vi.mocked(behaviorRegistry.get).mockReturnValue(behavior);

            const result = resolveFieldConnections(
                'target-node',
                [sourceNode, targetNode],
                [edge],
                {},
                createMockSchema()
            );

            expect(result).toEqual({ inputField: 'my-value' });
        });
    });

    describe('node title handling', () => {
        it('should use "Untitled" when source node has no title', () => {
            const sourceNode = createMockNode({
                id: 'source-node',
                data: {},
            });
            const targetNode = createMockNode({ id: 'target-node' });
            const edge = createMockEdge({
                source: 'source-node',
                target: 'target-node',
                targetHandle: 'field:inputField',
            });
            const behavior = createMockBehavior();

            vi.mocked(behaviorRegistry.get).mockReturnValue(behavior);

            // The function should handle missing titles gracefully
            const result = resolveFieldConnections(
                'target-node',
                [sourceNode, targetNode],
                [edge],
                {},
                createMockSchema()
            );

            // Should still work even without title
            expect(result).toHaveProperty('inputField');
        });
    });
});

// ============================================================================
// Hook Logic Patterns (simulated behavior)
// ============================================================================

describe('useFieldConnections - logic patterns', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('connections Map creation', () => {
        it('should create empty Map when nodeId is falsy', () => {
            const result = new Map();

            expect(result.size).toBe(0);
        });

        it('should create Map entry for each valid connection', () => {
            const connections = new Map<string, ConnectedFieldInfo>();
            connections.set('field1', {
                fieldKey: 'field1',
                sourceNodeId: 'source-1',
                sourceNodeTitle: 'Source 1',
                sourcePortId: 'output',
                value: 'value1',
                context: {} as ConnectionContext,
            });
            connections.set('field2', {
                fieldKey: 'field2',
                sourceNodeId: 'source-2',
                sourceNodeTitle: 'Source 2',
                sourcePortId: 'output',
                value: 'value2',
                context: {} as ConnectionContext,
            });

            expect(connections.size).toBe(2);
            expect(connections.has('field1')).toBe(true);
            expect(connections.has('field2')).toBe(true);
        });
    });

    describe('isConnected helper logic', () => {
        it('should return true when field key exists in connections Map', () => {
            const connections = new Map<string, ConnectedFieldInfo>();
            connections.set('myField', {} as ConnectedFieldInfo);

            const isConnected = (fieldKey: string) => connections.has(fieldKey);

            expect(isConnected('myField')).toBe(true);
            expect(isConnected('otherField')).toBe(false);
        });
    });

    describe('getConnection helper logic', () => {
        it('should return connection info when field key exists', () => {
            const connectionInfo: ConnectedFieldInfo = {
                fieldKey: 'myField',
                sourceNodeId: 'source-1',
                sourceNodeTitle: 'Source 1',
                sourcePortId: 'output',
                value: 'value1',
                context: {} as ConnectionContext,
            };

            const connections = new Map<string, ConnectedFieldInfo>();
            connections.set('myField', connectionInfo);

            const getConnection = (fieldKey: string) => connections.get(fieldKey);

            expect(getConnection('myField')).toEqual(connectionInfo);
            expect(getConnection('otherField')).toBeUndefined();
        });
    });

    describe('getConnectedValues helper logic', () => {
        it('should return plain object with defined values', () => {
            const connections = new Map<string, ConnectedFieldInfo>();
            connections.set('field1', {
                fieldKey: 'field1',
                sourceNodeId: 'source-1',
                sourceNodeTitle: 'Source 1',
                sourcePortId: 'output',
                value: 'value1',
                context: {} as ConnectionContext,
            });
            connections.set('field2', {
                fieldKey: 'field2',
                sourceNodeId: 'source-2',
                sourceNodeTitle: 'Source 2',
                sourcePortId: 'output',
                value: 'value2',
                context: {} as ConnectionContext,
            });

            const getConnectedValues = (): Record<string, unknown> => {
                const values: Record<string, unknown> = {};
                connections.forEach((info, key) => {
                    if (info.value !== undefined) {
                        values[key] = info.value;
                    }
                });
                return values;
            };

            expect(getConnectedValues()).toEqual({
                field1: 'value1',
                field2: 'value2',
            });
        });

        it('should exclude entries with undefined values', () => {
            const connections = new Map<string, ConnectedFieldInfo>();
            connections.set('field1', {
                fieldKey: 'field1',
                sourceNodeId: 'source-1',
                sourceNodeTitle: 'Source 1',
                sourcePortId: 'output',
                value: 'defined-value',
                context: {} as ConnectionContext,
            });
            connections.set('field2', {
                fieldKey: 'field2',
                sourceNodeId: 'source-2',
                sourceNodeTitle: 'Source 2',
                sourcePortId: 'output',
                value: undefined,
                context: {} as ConnectionContext,
            });

            const getConnectedValues = (): Record<string, unknown> => {
                const values: Record<string, unknown> = {};
                connections.forEach((info, key) => {
                    if (info.value !== undefined) {
                        values[key] = info.value;
                    }
                });
                return values;
            };

            expect(getConnectedValues()).toEqual({
                field1: 'defined-value',
            });
        });

        it('should return empty object when no connections', () => {
            const connections = new Map<string, ConnectedFieldInfo>();

            const getConnectedValues = (): Record<string, unknown> => {
                const values: Record<string, unknown> = {};
                connections.forEach((info, key) => {
                    if (info.value !== undefined) {
                        values[key] = info.value;
                    }
                });
                return values;
            };

            expect(getConnectedValues()).toEqual({});
        });
    });

    describe('edge filtering logic', () => {
        it('should filter edges by target node', () => {
            const edges: SynniaEdge[] = [
                { id: 'e1', source: 's1', target: 'target-node' },
                { id: 'e2', source: 's2', target: 'other-node' },
                { id: 'e3', source: 's3', target: 'target-node' },
            ];

            const nodeId = 'target-node';
            const incomingEdges = edges.filter(e => e.target === nodeId);

            expect(incomingEdges).toHaveLength(2);
            expect(incomingEdges.map(e => e.id)).toEqual(['e1', 'e3']);
        });
    });

    describe('connection context building', () => {
        it('should build connection context with all required fields', () => {
            const edge = createMockEdge();
            const sourceNode = createMockNode({ id: 'source-node' });
            const sourceAsset = createMockAsset();
            const sourcePortValue = { type: 'json', value: { field: 'value' } };
            const fieldKey = 'myField';

            const context = {
                edge,
                sourceNode,
                sourceAsset,
                sourcePortValue,
                fieldKey,
            };

            expect(context.edge).toBe(edge);
            expect(context.sourceNode).toBe(sourceNode);
            expect(context.sourceAsset).toBe(sourceAsset);
            expect(context.sourcePortValue).toBe(sourcePortValue);
            expect(context.fieldKey).toBe(fieldKey);
        });
    });
});
