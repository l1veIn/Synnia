// @ts-nocheck
/**
 * FormBehavior Tests
 * Tests for FormNode behavior including port resolution and connection validation
 */

 

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FormBehavior } from '../behavior';
import type { SynniaNode, SynniaEdge } from '@/presentation/types/project';
import type { Asset, FieldDefinition } from '@/domain/asset/types';
import type { ConnectionContext } from '@/presentation/engine/types/behavior';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/store/workflowStore', () => ({
    useWorkflowStore: {
        getState: vi.fn(() => ({
            nodes: [],
            edges: [],
            assets: {},
        })),
    },
}));

vi.mock('@/hooks/useInspector', () => ({
    getConnectedFieldValues: vi.fn(() => ({})),
}));

vi.mock('@/domain/edge/ValueMappingService', () => ({
    smartResolveError: vi.fn(() => null),
}));

import { useWorkflowStore } from '@/store/workflowStore';
import { getConnectedFieldValues } from '@/presentation/hooks/useInspector';
import { smartResolveError } from '@/domain/edge/ValueMappingService';

// ============================================================================
// Test Helpers
// ============================================================================

const createMockNode = (overrides: Partial<SynniaNode> = {}): SynniaNode => ({
    id: 'node-1',
    type: 'form',
    position: { x: 0, y: 0 },
    data: { title: 'Test Form' },
    ...overrides,
});

const createMockAsset = (overrides: Partial<Asset> = {}): Asset => ({
    id: 'asset-1',
    valueType: 'record',
    value: {},
    valueMeta: {},
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

const createMockEdge = (overrides: Partial<SynniaEdge> = {}): SynniaEdge => ({
    id: 'edge-1',
    source: 'source-node',
    target: 'target-node',
    sourceHandle: 'output',
    targetHandle: 'input',
    ...overrides,
});

const createMockContext = (overrides: Partial<ConnectionContext> = {}): ConnectionContext => ({
    edge: createMockEdge(),
    sourceNode: createMockNode({ id: 'source-node' }),
    targetNode: createMockNode({ id: 'target-node' }),
    sourceAsset: null,
    targetAsset: null,
    sourcePortValue: null,
    ...overrides,
});

const createField = (overrides: Partial<FieldDefinition> = {}): FieldDefinition => ({
    key: 'testField',
    type: 'string',
    ...overrides,
});

// ============================================================================
// resolveOutput Tests - output/origin ports
// ============================================================================

describe('FormBehavior - resolveOutput - output/origin', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getConnectedFieldValues).mockReturnValue({});
    });

    it('should return json output with own value for output port', () => {
        const node = createMockNode();
        const assetValue = { name: 'test', count: 42 };
        const asset = createMockAsset({ value: assetValue });

        vi.mocked(useWorkflowStore.getState).mockReturnValue({
            nodes: [node],
            edges: [],
            assets: {},
        } as any);

        const result = FormBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'json',
            value: assetValue,
            meta: { nodeId: node.id, portId: 'output' },
        });
    });

    it('should return json output with own value for origin port', () => {
        const node = createMockNode();
        const assetValue = { data: 'value' };
        const asset = createMockAsset({ value: assetValue });

        vi.mocked(useWorkflowStore.getState).mockReturnValue({
            nodes: [node],
            edges: [],
            assets: {},
        } as any);

        const result = FormBehavior.resolveOutput!(node, asset, 'origin');

        expect(result).toEqual({
            type: 'json',
            value: assetValue,
            meta: { nodeId: node.id, portId: 'origin' },
        });
    });

    it('should merge own values with connected values', () => {
        const node = createMockNode();
        const ownValue = { ownField: 'own' };
        const connectedValue = { connectedField: 'connected' };
        const asset = createMockAsset({ value: ownValue });

        vi.mocked(useWorkflowStore.getState).mockReturnValue({
            nodes: [node],
            edges: [],
            assets: {},
        } as any);
        vi.mocked(getConnectedFieldValues).mockReturnValue(connectedValue);

        const result = FormBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'json',
            value: { ...ownValue, ...connectedValue },
            meta: { nodeId: node.id, portId: 'output' },
        });
    });

    it('should prioritize connected values over own values', () => {
        const node = createMockNode();
        const ownValue = { field: 'ownValue', otherField: 'keep' };
        const connectedValue = { field: 'connectedValue' };
        const asset = createMockAsset({ value: ownValue });

        vi.mocked(useWorkflowStore.getState).mockReturnValue({
            nodes: [node],
            edges: [],
            assets: {},
        } as any);
        vi.mocked(getConnectedFieldValues).mockReturnValue(connectedValue);

        const result = FormBehavior.resolveOutput!(node, asset, 'output');

        expect(result?.value).toEqual({
            field: 'connectedValue',
            otherField: 'keep',
        });
    });

    it('should return empty object when asset has no value', () => {
        const node = createMockNode();
        const asset = createMockAsset({ value: undefined });

        vi.mocked(useWorkflowStore.getState).mockReturnValue({
            nodes: [node],
            edges: [],
            assets: {},
        } as any);

        const result = FormBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'json',
            value: {},
            meta: { nodeId: node.id, portId: 'output' },
        });
    });

    it('should return empty object when asset is null', () => {
        const node = createMockNode();

        vi.mocked(useWorkflowStore.getState).mockReturnValue({
            nodes: [node],
            edges: [],
            assets: {},
        } as any);

        const result = FormBehavior.resolveOutput!(node, null, 'output');

        expect(result).toEqual({
            type: 'json',
            value: {},
            meta: { nodeId: node.id, portId: 'output' },
        });
    });
});

// ============================================================================
// resolveOutput Tests - array port
// ============================================================================

describe('FormBehavior - resolveOutput - array port', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return array type for array port', () => {
        const node = createMockNode();
        const asset = createMockAsset({ value: { data: 'test' } });

        vi.mocked(useWorkflowStore.getState).mockReturnValue({
            nodes: [node],
            edges: [],
            assets: {},
        } as any);
        vi.mocked(getConnectedFieldValues).mockReturnValue({});

        const result = FormBehavior.resolveOutput!(node, asset, 'array');

        expect(result?.type).toBe('array');
        expect(Array.isArray(result?.value)).toBe(true);
    });

    it('should collect values from docked chain in reverse order', () => {
        const node1 = createMockNode({ id: 'node-1', data: { assetId: 'asset-1', dockedTo: null } });
        const node2 = createMockNode({ id: 'node-2', data: { assetId: 'asset-2', dockedTo: 'node-1' } });
        const node3 = createMockNode({ id: 'node-3', data: { assetId: 'asset-3', dockedTo: 'node-2' } });

        const asset1 = createMockAsset({ id: 'asset-1', value: { id: 1 } });
        const asset2 = createMockAsset({ id: 'asset-2', value: { id: 2 } });
        const asset3 = createMockAsset({ id: 'asset-3', value: { id: 3 } });

        vi.mocked(useWorkflowStore.getState).mockReturnValue({
            nodes: [node1, node2, node3],
            edges: [],
            assets: {
                'asset-1': asset1,
                'asset-2': asset2,
                'asset-3': asset3,
            },
        } as any);
        vi.mocked(getConnectedFieldValues).mockReturnValue({});

        const result = FormBehavior.resolveOutput!(node3, asset3, 'array');

        // Should collect from node3 -> node2 -> node1 and unshift, so order is [node1, node2, node3]
        expect(result?.value).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    });

    it('should skip nodes with empty values in docked chain', () => {
        const node1 = createMockNode({ id: 'node-1', data: { assetId: 'asset-1', dockedTo: null } });
        const node2 = createMockNode({ id: 'node-2', data: { assetId: 'asset-2', dockedTo: 'node-1' } });

        const asset1 = createMockAsset({ id: 'asset-1', value: {} });
        const asset2 = createMockAsset({ id: 'asset-2', value: { data: 'test' } });

        vi.mocked(useWorkflowStore.getState).mockReturnValue({
            nodes: [node1, node2],
            edges: [],
            assets: {
                'asset-1': asset1,
                'asset-2': asset2,
            },
        } as any);
        vi.mocked(getConnectedFieldValues).mockReturnValue({});

        const result = FormBehavior.resolveOutput!(node2, asset2, 'array');

        // Only node2 should be included (node1 has empty value)
        expect(result?.value).toEqual([{ data: 'test' }]);
    });

    it('should merge connected values for each node in docked chain', () => {
        const node1 = createMockNode({ id: 'node-1', data: { assetId: 'asset-1', dockedTo: null } });
        const node2 = createMockNode({ id: 'node-2', data: { assetId: 'asset-2', dockedTo: 'node-1' } });

        const asset1 = createMockAsset({ id: 'asset-1', value: { own: 'value1' } });
        const asset2 = createMockAsset({ id: 'asset-2', value: { own: 'value2' } });

        vi.mocked(useWorkflowStore.getState).mockReturnValue({
            nodes: [node1, node2],
            edges: [],
            assets: {
                'asset-1': asset1,
                'asset-2': asset2,
            },
        } as any);

        // Mock connected values based on nodeId - function is called with nodeId as first arg
        vi.mocked(getConnectedFieldValues).mockImplementation((nodeId) => {
            if (nodeId === 'node-2') return { connected: 'from2' };
            if (nodeId === 'node-1') return { connected: 'from1' };
            return {};
        });

        const result = FormBehavior.resolveOutput!(node2, asset2, 'array');

        expect(result?.value).toEqual([
            { own: 'value1', connected: 'from1' },
            { own: 'value2', connected: 'from2' },
        ]);
    });

    it('should return empty array when no docked chain exists', () => {
        const node = createMockNode();
        const asset = createMockAsset({ value: {} });

        vi.mocked(useWorkflowStore.getState).mockReturnValue({
            nodes: [node],
            edges: [],
            assets: {},
        } as any);
        vi.mocked(getConnectedFieldValues).mockReturnValue({});

        const result = FormBehavior.resolveOutput!(node, asset, 'array');

        expect(result?.value).toEqual([]);
    });

    it('should stop traversal when node not found in store', () => {
        const node2 = createMockNode({ id: 'node-2', data: { assetId: 'asset-2', dockedTo: 'node-1' } });
        // node-3 has dockedTo pointing to non-existent node
        const node3 = createMockNode({ id: 'node-3', data: { assetId: 'asset-3', dockedTo: 'non-existent' } });

        const asset2 = createMockAsset({ id: 'asset-2', value: { step: 2 } });
        const asset3 = createMockAsset({ id: 'asset-3', value: { step: 3 } });

        // Only include node2 and node3, not node1 (which node2 is docked to)
        vi.mocked(useWorkflowStore.getState).mockReturnValue({
            nodes: [node2, node3],
            edges: [],
            assets: {
                'asset-2': asset2,
                'asset-3': asset3,
            },
        } as any);
        vi.mocked(getConnectedFieldValues).mockReturnValue({});

        const result = FormBehavior.resolveOutput!(node3, asset3, 'array');

        // Should only include node3 (node2's chain breaks when node1 is not found)
        expect(result?.value).toEqual([{ step: 3 }]);
    });

    it('should handle missing asset in docked chain', () => {
        const node1 = createMockNode({ id: 'node-1', data: { assetId: 'asset-1', dockedTo: null } });
        const node2 = createMockNode({ id: 'node-2', data: { assetId: 'non-existent-asset', dockedTo: 'node-1' } });

        const asset1 = createMockAsset({ id: 'asset-1', value: { step: 1 } });

        vi.mocked(useWorkflowStore.getState).mockReturnValue({
            nodes: [node1, node2],
            edges: [],
            assets: {
                'asset-1': asset1,
                // non-existent-asset is not in assets
            },
        } as any);
        vi.mocked(getConnectedFieldValues).mockReturnValue({});

        const result = FormBehavior.resolveOutput!(node2, undefined, 'array');

        // node2 has no asset, node1 is in chain but unreachable from node2 (empty values are skipped)
        expect(result?.value).toEqual([{ step: 1 }]);
    });
});

// ============================================================================
// resolveOutput Tests - field: prefixed ports
// ============================================================================

describe('FormBehavior - resolveOutput - field: prefixed ports', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getConnectedFieldValues).mockReturnValue({});
    });

    it('should extract field value for field: prefixed port', () => {
        const node = createMockNode();
        const assetValue = { name: 'John', age: 30, active: true };
        const asset = createMockAsset({ value: assetValue });

        vi.mocked(useWorkflowStore.getState).mockReturnValue({
            nodes: [node],
            edges: [],
            assets: {},
        } as any);

        const result = FormBehavior.resolveOutput!(node, asset, 'field:name');

        expect(result).toEqual({
            type: 'text',
            value: 'John',
            meta: { nodeId: node.id, portId: 'field:name' },
        });
    });

    it('should return json type for object field value', () => {
        const node = createMockNode();
        const assetValue = { config: { key: 'value', nested: { deep: true } } };
        const asset = createMockAsset({ value: assetValue });

        vi.mocked(useWorkflowStore.getState).mockReturnValue({
            nodes: [node],
            edges: [],
            assets: {},
        } as any);

        const result = FormBehavior.resolveOutput!(node, asset, 'field:config');

        expect(result).toEqual({
            type: 'json',
            value: { key: 'value', nested: { deep: true } },
            meta: { nodeId: node.id, portId: 'field:config' },
        });
    });

    it('should return json type for array field value', () => {
        const node = createMockNode();
        const assetValue = { items: [1, 2, 3] };
        const asset = createMockAsset({ value: assetValue });

        vi.mocked(useWorkflowStore.getState).mockReturnValue({
            nodes: [node],
            edges: [],
            assets: {},
        } as any);

        const result = FormBehavior.resolveOutput!(node, asset, 'field:items');

        expect(result).toEqual({
            type: 'json',
            value: [1, 2, 3],
            meta: { nodeId: node.id, portId: 'field:items' },
        });
    });

    it('should prioritize connected value over own value for field: port', () => {
        const node = createMockNode();
        const ownValue = { field: 'ownValue' };
        const connectedValue = { field: 'connectedValue' };
        const asset = createMockAsset({ value: ownValue });

        vi.mocked(useWorkflowStore.getState).mockReturnValue({
            nodes: [node],
            edges: [],
            assets: {},
        } as any);
        vi.mocked(getConnectedFieldValues).mockReturnValue(connectedValue);

        const result = FormBehavior.resolveOutput!(node, asset, 'field:field');

        expect(result).toEqual({
            type: 'text',
            value: 'connectedValue',
            meta: { nodeId: node.id, portId: 'field:field' },
        });
    });

    it('should return null for non-existent field: prefixed port', () => {
        const node = createMockNode();
        const assetValue = { name: 'John' };
        const asset = createMockAsset({ value: assetValue });

        vi.mocked(useWorkflowStore.getState).mockReturnValue({
            nodes: [node],
            edges: [],
            assets: {},
        } as any);

        const result = FormBehavior.resolveOutput!(node, asset, 'field:nonExistent');
        expect(result).toBeNull();
    });

    it('should return null when field value is undefined', () => {
        const node = createMockNode();
        const assetValue = { name: 'John' };
        const asset = createMockAsset({ value: assetValue });

        vi.mocked(useWorkflowStore.getState).mockReturnValue({
            nodes: [node],
            edges: [],
            assets: {},
        } as any);

        const result = FormBehavior.resolveOutput!(node, asset, 'field:missing');
        expect(result).toBeNull();
    });

    it('should handle numeric field values', () => {
        const node = createMockNode();
        const assetValue = { count: 42, price: 19.99 };
        const asset = createMockAsset({ value: assetValue });

        vi.mocked(useWorkflowStore.getState).mockReturnValue({
            nodes: [node],
            edges: [],
            assets: {},
        } as any);

        const result = FormBehavior.resolveOutput!(node, asset, 'field:count');

        expect(result).toEqual({
            type: 'text',
            value: 42,
            meta: { nodeId: node.id, portId: 'field:count' },
        });
    });

    it('should handle boolean field values', () => {
        const node = createMockNode();
        const assetValue = { active: true, deleted: false };
        const asset = createMockAsset({ value: assetValue });

        vi.mocked(useWorkflowStore.getState).mockReturnValue({
            nodes: [node],
            edges: [],
            assets: {},
        } as any);

        const result = FormBehavior.resolveOutput!(node, asset, 'field:active');

        expect(result).toEqual({
            type: 'text',
            value: true,
            meta: { nodeId: node.id, portId: 'field:active' },
        });
    });
});

// ============================================================================
// resolveOutput Tests - unknown port
// ============================================================================

describe('FormBehavior - resolveOutput - unknown port', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getConnectedFieldValues).mockReturnValue({});
    });

    it('should return null for unknown port', () => {
        const node = createMockNode();
        const asset = createMockAsset({ value: { data: 'test' } });

        vi.mocked(useWorkflowStore.getState).mockReturnValue({
            nodes: [node],
            edges: [],
            assets: {},
        } as any);

        const result = FormBehavior.resolveOutput!(node, asset, 'unknownPort');
        expect(result).toBeNull();
    });
});

// ============================================================================
// canConnect Tests
// ============================================================================

describe('FormBehavior - canConnect', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should allow connection to output ports (return null)', () => {
        const outputPorts = ['output', 'origin', 'array'];

        for (const port of outputPorts) {
            const ctx = createMockContext({
                edge: createMockEdge({ targetHandle: port }),
            });
            const result = FormBehavior.canConnect!(ctx);
            expect(result).toBeNull();
        }
    });

    it('should allow connection when targetHandle is null', () => {
        const ctx = createMockContext({
            edge: createMockEdge({ targetHandle: null }),
        });
        const result = FormBehavior.canConnect!(ctx);
        expect(result).toBeNull();
    });

    it('should return error when source has no output data', () => {
        const ctx = createMockContext({
            edge: createMockEdge({ targetHandle: 'inputField' }),
            targetAsset: createMockAsset({
                config: { schema: [createField({ key: 'inputField' })] },
            }),
            sourcePortValue: null,
        });

        const result = FormBehavior.canConnect!(ctx);
        expect(result).toContain('Source node has no output data');
    });

    it('should return error when source port value has no value', () => {
        const ctx = createMockContext({
            edge: createMockEdge({ targetHandle: 'inputField' }),
            targetAsset: createMockAsset({
                config: { schema: [createField({ key: 'inputField' })] },
            }),
            sourcePortValue: { type: 'text', value: undefined },
        });

        const result = FormBehavior.canConnect!(ctx);
        expect(result).toContain('Source node has no output data');
    });

    it('should return error when target field definition is missing', () => {
        const asset = createMockAsset({
            config: { schema: [createField({ key: 'otherField' })] },
        });

        const ctx = createMockContext({
            edge: createMockEdge({ targetHandle: 'nonExistentField' }),
            targetAsset: asset,
            sourcePortValue: { type: 'text', value: 'test' },
        });

        const result = FormBehavior.canConnect!(ctx);
        expect(result).toContain('Target field definition is missing');
    });

    it('should find field in asset.config.schema', () => {
        const schema = [createField({ key: 'name', type: 'string' }), createField({ key: 'age', type: 'number' })];
        const asset = createMockAsset({
            config: { schema },
        });

        const ctx = createMockContext({
            edge: createMockEdge({ targetHandle: 'name' }),
            targetAsset: asset,
            sourcePortValue: { type: 'json', value: { name: 'John' } },
        });

        vi.mocked(smartResolveError).mockReturnValue(null);

        const result = FormBehavior.canConnect!(ctx);

        expect(smartResolveError).toHaveBeenCalledWith({ name: 'John' }, schema[0]);
        expect(result).toBeNull();
    });

    it('should find field in asset.schema (fallback)', () => {
        const schema = [createField({ key: 'email', type: 'string' })];
        const asset = createMockAsset() as any;
        asset.schema = schema;
        asset.config = undefined;

        const ctx = createMockContext({
            edge: createMockEdge({ targetHandle: 'email' }),
            targetAsset: asset,
            sourcePortValue: { type: 'text', value: 'test@example.com' },
        });

        vi.mocked(smartResolveError).mockReturnValue(null);

        const result = FormBehavior.canConnect!(ctx);

        expect(smartResolveError).toHaveBeenCalledWith('test@example.com', schema[0]);
        expect(result).toBeNull();
    });

    it('should use smartResolve to validate connection', () => {
        const sourceValue = { username: 'testuser' };
        const targetField = createField({ key: 'username', type: 'string', required: true });

        const ctx = createMockContext({
            edge: createMockEdge({ targetHandle: 'username' }),
            targetAsset: createMockAsset({
                config: { schema: [targetField] },
            }),
            sourcePortValue: { type: 'json', value: sourceValue },
        });

        vi.mocked(smartResolveError).mockReturnValue(null);

        const result = FormBehavior.canConnect!(ctx);
        expect(smartResolveError).toHaveBeenCalledWith(sourceValue, targetField);
        expect(result).toBeNull();
    });

    it('should return error when smartResolve fails', () => {
        const sourceValue = { count: 'not-a-number' };
        const targetField = createField({ key: 'count', type: 'number', required: true });

        const ctx = createMockContext({
            edge: createMockEdge({ targetHandle: 'count' }),
            targetAsset: createMockAsset({
                config: { schema: [targetField] },
            }),
            sourcePortValue: { type: 'json', value: sourceValue },
        });

        vi.mocked(smartResolveError).mockReturnValue('Type mismatch: expected number');

        const result = FormBehavior.canConnect!(ctx);
        expect(result).toBe('Type mismatch: expected number');
    });

    it('should allow connection when smartResolve passes', () => {
        const sourceValue = { status: 'active' };
        const targetField = createField({ key: 'status', type: 'string', required: true });

        const ctx = createMockContext({
            edge: createMockEdge({ targetHandle: 'status' }),
            targetAsset: createMockAsset({
                config: { schema: [targetField] },
            }),
            sourcePortValue: { type: 'json', value: sourceValue },
        });

        vi.mocked(smartResolveError).mockReturnValue(null);

        const result = FormBehavior.canConnect!(ctx);
        expect(result).toBeNull();
    });
});

// ============================================================================
// onConnect Tests
// ============================================================================

describe('FormBehavior - onConnect', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return null (no data copying)', () => {
        const ctx = createMockContext();

        const result = FormBehavior.onConnect!(ctx);
        expect(result).toBeNull();
    });

    it('should handle connection without modifying state', () => {
        const sourceNode = createMockNode({ id: 'source', type: 'form' });
        const targetNode = createMockNode({ id: 'target', type: 'form' });
        const sourceAsset = createMockAsset({ value: { text: 'hello' } });
        const targetAsset = createMockAsset({
            value: {},
            config: { schema: [createField({ key: 'prompt' })] },
        });

        const ctx = createMockContext({
            sourceNode,
            targetNode,
            sourceAsset,
            targetAsset,
            edge: createMockEdge({ targetHandle: 'prompt' }),
            sourcePortValue: { type: 'text', value: 'hello' },
        });

        const result = FormBehavior.onConnect!(ctx);
        expect(result).toBeNull();
    });

    it('should not copy data to node storage', () => {
        const ctx = createMockContext({
            sourcePortValue: { type: 'json', value: { data: 'some data' } },
            targetAsset: createMockAsset({
                value: {},
                config: { schema: [createField({ key: 'data' })] },
            }),
        });

        const result = FormBehavior.onConnect!(ctx);
        expect(result).toBeNull();
    });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('FormBehavior - Integration scenarios', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should handle complete connection flow for form to form', () => {
        const sourceForm = createMockNode({ id: 'form-1', type: 'form' });
        const targetForm = createMockNode({ id: 'form-2', type: 'form' });

        const sourceAsset = createMockAsset({ value: { username: 'john_doe' } });
        const targetAsset = createMockAsset({
            value: {},
            config: {
                schema: [createField({ key: 'username', type: 'string', required: true })],
            },
        });

        const ctx = createMockContext({
            sourceNode: sourceForm,
            targetNode: targetForm,
            sourceAsset,
            targetAsset,
            edge: createMockEdge({ targetHandle: 'username' }),
            sourcePortValue: { type: 'text', value: 'john_doe' },
        });

        vi.mocked(smartResolveError).mockReturnValue(null);

        const canConnectResult = FormBehavior.canConnect!(ctx);
        expect(canConnectResult).toBeNull();

        const onConnectResult = FormBehavior.onConnect!(ctx);
        expect(onConnectResult).toBeNull();
    });

    it('should reject incompatible types', () => {
        const sourceForm = createMockNode({ id: 'form-1', type: 'form' });
        const targetForm = createMockNode({ id: 'form-2', type: 'form' });

        const sourceAsset = createMockAsset({ value: { items: [1, 2, 3] } });
        const targetAsset = createMockAsset({
            value: {},
            config: {
                schema: [createField({ key: 'singleItem', type: 'object', required: true })],
            },
        });

        const ctx = createMockContext({
            sourceNode: sourceForm,
            targetNode: targetForm,
            sourceAsset,
            targetAsset,
            edge: createMockEdge({ targetHandle: 'singleItem' }),
            sourcePortValue: { type: 'json', value: { items: [1, 2, 3] } },
        });

        vi.mocked(smartResolveError).mockReturnValue('Array cannot be used for object field');

        const result = FormBehavior.canConnect!(ctx);
        expect(result).toContain('Array cannot be used');
    });

    it('should resolve output with connected values', () => {
        const formNode = createMockNode({ id: 'form-1', type: 'form' });
        const upstreamValue = { field1: 'from upstream', field2: 'also upstream' };

        const formAsset = createMockAsset({
            value: { ownField: 'own value' },
            config: { schema: [] },
        });

        vi.mocked(useWorkflowStore.getState).mockReturnValue({
            nodes: [formNode],
            edges: [],
            assets: {},
        } as any);
        vi.mocked(getConnectedFieldValues).mockReturnValue(upstreamValue);

        const result = FormBehavior.resolveOutput!(formNode, formAsset, 'output');

        expect(result).toEqual({
            type: 'json',
            value: { ownField: 'own value', field1: 'from upstream', field2: 'also upstream' },
            meta: { nodeId: 'form-1', portId: 'output' },
        });
    });

    it('should handle docked chain resolution for array output', () => {
        const node1 = createMockNode({ id: 'form-1', data: { assetId: 'asset-1', dockedTo: null } });
        const node2 = createMockNode({ id: 'form-2', data: { assetId: 'asset-2', dockedTo: 'form-1' } });
        const node3 = createMockNode({ id: 'form-3', data: { assetId: 'asset-3', dockedTo: 'form-2' } });

        const asset1 = createMockAsset({ id: 'asset-1', value: { step: 1 } });
        const asset2 = createMockAsset({ id: 'asset-2', value: { step: 2 } });
        const asset3 = createMockAsset({ id: 'asset-3', value: { step: 3 } });

        vi.mocked(useWorkflowStore.getState).mockReturnValue({
            nodes: [node1, node2, node3],
            edges: [],
            assets: {
                'asset-1': asset1,
                'asset-2': asset2,
                'asset-3': asset3,
            },
        } as any);
        vi.mocked(getConnectedFieldValues).mockReturnValue({});

        const result = FormBehavior.resolveOutput!(node3, asset3, 'array');

        expect(result?.type).toBe('array');
        expect(result?.value).toEqual([{ step: 1 }, { step: 2 }, { step: 3 }]);
    });
});
