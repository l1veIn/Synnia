// @ts-nocheck
/**
 * TableBehavior Tests
 * Tests for TableNode behavior including port resolution
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TableBehavior } from '../behavior';
import type { SynniaNode } from '@/types/project';
import type { Asset } from '@/types/assets';

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

// ============================================================================
// Test Helpers
// ============================================================================

const createMockNode = (overrides: Partial<SynniaNode> = {}): SynniaNode => ({
    id: 'node-1',
    type: 'table',
    position: { x: 0, y: 0 },
    data: { title: 'Test Table' },
    ...overrides,
});

const createMockAsset = (overrides: Partial<Asset> = {}): Asset => ({
    id: 'asset-1',
    valueType: 'array',
    value: [],
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

// ============================================================================
// resolveOutput Tests - output port
// ============================================================================

describe('TableBehavior - resolveOutput - output port', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return array output with rows for output port', () => {
        const node = createMockNode();
        const rows = [
            { id: 1, name: 'Alice', age: 30 },
            { id: 2, name: 'Bob', age: 25 },
        ];
        const asset = createMockAsset({
            valueType: 'array',
            value: rows,
        });

        const result = TableBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'array',
            value: rows,
            meta: { nodeId: node.id, portId: 'output' },
        });
    });

    it('should return array output with empty array when value is empty', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'array',
            value: [],
        });

        const result = TableBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'array',
            value: [],
            meta: { nodeId: node.id, portId: 'output' },
        });
    });

    it('should return null when asset is null', () => {
        const node = createMockNode();

        const result = TableBehavior.resolveOutput!(node, null, 'output');

        expect(result).toBeNull();
    });

    it('should return null when asset value is null', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'array',
            value: null as any,
        });

        const result = TableBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toBeNull();
    });

    it('should return null when asset value is undefined', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'array',
            value: undefined as any,
        });

        const result = TableBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toBeNull();
    });

    it('should handle single row table', () => {
        const node = createMockNode();
        const rows = [{ id: 1, name: 'Single' }];
        const asset = createMockAsset({
            valueType: 'array',
            value: rows,
        });

        const result = TableBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'array',
            value: rows,
            meta: { nodeId: node.id, portId: 'output' },
        });
    });

    it('should handle table with many rows', () => {
        const node = createMockNode();
        const rows = Array.from({ length: 100 }, (_, i) => ({
            id: i,
            name: `Row ${i}`,
        }));
        const asset = createMockAsset({
            valueType: 'array',
            value: rows,
        });

        const result = TableBehavior.resolveOutput!(node, asset, 'output');

        expect(result?.type).toBe('array');
        expect((result?.value as any[])).toHaveLength(100);
    });

    it('should handle table rows with various data types', () => {
        const node = createMockNode();
        const rows = [
            { id: 1, name: 'Alice', active: true, score: 95.5, tags: ['vip', 'premium'] },
            { id: 2, name: 'Bob', active: false, score: 82.0, tags: ['standard'] },
        ];
        const asset = createMockAsset({
            valueType: 'array',
            value: rows,
        });

        const result = TableBehavior.resolveOutput!(node, asset, 'output');

        expect(result?.value).toEqual(rows);
    });
});

// ============================================================================
// resolveOutput Tests - origin port
// ============================================================================

describe('TableBehavior - resolveOutput - origin port', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return array output with rows for origin port', () => {
        const node = createMockNode();
        const rows = [{ id: 1, name: 'Alice' }];
        const asset = createMockAsset({
            valueType: 'array',
            value: rows,
        });

        const result = TableBehavior.resolveOutput!(node, asset, 'origin');

        expect(result).toEqual({
            type: 'array',
            value: rows,
            meta: { nodeId: node.id, portId: 'origin' },
        });
    });

    it('should return empty array for origin port when table is empty', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'array',
            value: [],
        });

        const result = TableBehavior.resolveOutput!(node, asset, 'origin');

        expect(result).toEqual({
            type: 'array',
            value: [],
            meta: { nodeId: node.id, portId: 'origin' },
        });
    });

    it('should return null when asset is null for origin port', () => {
        const node = createMockNode();

        const result = TableBehavior.resolveOutput!(node, null, 'origin');

        expect(result).toBeNull();
    });
});

// ============================================================================
// resolveOutput Tests - field: prefixed ports
// ============================================================================

describe('TableBehavior - resolveOutput - field: ports', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return text value for field: port when field exists in first row', () => {
        const node = createMockNode();
        const rows = [
            { id: 1, name: 'Alice', age: 30 },
            { id: 2, name: 'Bob', age: 25 },
        ];
        const asset = createMockAsset({
            valueType: 'array',
            value: rows,
        });

        const result = TableBehavior.resolveOutput!(node, asset, 'field:name');

        expect(result).toEqual({
            type: 'text',
            value: 'Alice',
            meta: { nodeId: node.id, portId: 'field:name' },
        });
    });

    it('should return json type for object field values', () => {
        const node = createMockNode();
        const rows = [
            { id: 1, metadata: { key: 'value', nested: { x: 1 } } },
        ];
        const asset = createMockAsset({
            valueType: 'array',
            value: rows,
        });

        const result = TableBehavior.resolveOutput!(node, asset, 'field:metadata');

        expect(result).toEqual({
            type: 'json',
            value: { key: 'value', nested: { x: 1 } },
            meta: { nodeId: node.id, portId: 'field:metadata' },
        });
    });

    it('should return null for field: port when field does not exist', () => {
        const node = createMockNode();
        const rows = [{ id: 1, name: 'Alice' }];
        const asset = createMockAsset({
            valueType: 'array',
            value: rows,
        });

        const result = TableBehavior.resolveOutput!(node, asset, 'field:nonexistent');

        expect(result).toBeNull();
    });

    it('should return null for field: port when field value is undefined', () => {
        const node = createMockNode();
        const rows = [{ id: 1, name: 'Alice', age: undefined }];
        const asset = createMockAsset({
            valueType: 'array',
            value: rows,
        });

        const result = TableBehavior.resolveOutput!(node, asset, 'field:age');

        expect(result).toBeNull();
    });

    it('should return null for field: port when rows array is empty', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'array',
            value: [],
        });

        const result = TableBehavior.resolveOutput!(node, asset, 'field:name');

        expect(result).toBeNull();
    });

    it('should handle numeric field values', () => {
        const node = createMockNode();
        const rows = [{ id: 1, count: 42, price: 19.99 }];
        const asset = createMockAsset({
            valueType: 'array',
            value: rows,
        });

        const result = TableBehavior.resolveOutput!(node, asset, 'field:count');

        expect(result).toEqual({
            type: 'text',
            value: 42,
            meta: { nodeId: node.id, portId: 'field:count' },
        });
    });

    it('should handle boolean field values', () => {
        const node = createMockNode();
        const rows = [{ id: 1, active: true }];
        const asset = createMockAsset({
            valueType: 'array',
            value: rows,
        });

        const result = TableBehavior.resolveOutput!(node, asset, 'field:active');

        expect(result).toEqual({
            type: 'text',
            value: true,
            meta: { nodeId: node.id, portId: 'field:active' },
        });
    });

    it('should handle null field values (returns json type since typeof null === "object")', () => {
        const node = createMockNode();
        const rows = [{ id: 1, name: null }];
        const asset = createMockAsset({
            valueType: 'array',
            value: rows,
        });

        const result = TableBehavior.resolveOutput!(node, asset, 'field:name');

        expect(result).toEqual({
            type: 'json',
            value: null,
            meta: { nodeId: node.id, portId: 'field:name' },
        });
    });

    it('should handle array field values (json type)', () => {
        const node = createMockNode();
        const rows = [{ id: 1, tags: ['vip', 'premium'] }];
        const asset = createMockAsset({
            valueType: 'array',
            value: rows,
        });

        const result = TableBehavior.resolveOutput!(node, asset, 'field:tags');

        expect(result).toEqual({
            type: 'json',
            value: ['vip', 'premium'],
            meta: { nodeId: node.id, portId: 'field:tags' },
        });
    });
});

// ============================================================================
// resolveOutput Tests - object value with rows property
// ============================================================================

describe('TableBehavior - resolveOutput - value with rows property', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should extract rows from value.rows property', () => {
        const node = createMockNode();
        const rows = [{ id: 1, name: 'Alice' }];
        const asset = createMockAsset({
            valueType: 'array' as any,
            value: { rows, totalCount: 1 },
        });

        const result = TableBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'array',
            value: rows,
            meta: { nodeId: node.id, portId: 'output' },
        });
    });

    it('should handle empty rows array in value.rows', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'array' as any,
            value: { rows: [], totalCount: 0 },
        });

        const result = TableBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'array',
            value: [],
            meta: { nodeId: node.id, portId: 'output' },
        });
    });

    it('should handle missing rows property in object value', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'array' as any,
            value: { totalCount: 5 },
        });

        const result = TableBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'array',
            value: [],
            meta: { nodeId: node.id, portId: 'output' },
        });
    });
});

// ============================================================================
// resolveOutput Tests - unknown port
// ============================================================================

describe('TableBehavior - resolveOutput - unknown port', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return null for unknown port', () => {
        const node = createMockNode();
        const rows = [{ id: 1, name: 'Alice' }];
        const asset = createMockAsset({
            valueType: 'array',
            value: rows,
        });

        const result = TableBehavior.resolveOutput!(node, asset, 'unknownPort');

        expect(result).toBeNull();
    });

    it('should return null for input ports', () => {
        const node = createMockNode();
        const rows = [{ id: 1, name: 'Alice' }];
        const asset = createMockAsset({
            valueType: 'array',
            value: rows,
        });

        const result = TableBehavior.resolveOutput!(node, asset, 'input');

        expect(result).toBeNull();
    });

    it('should return null for field: port when asset is null', () => {
        const node = createMockNode();

        const result = TableBehavior.resolveOutput!(node, null, 'field:name');

        expect(result).toBeNull();
    });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('TableBehavior - Integration scenarios', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should handle complete table with various field types', () => {
        const node = createMockNode({ id: 'table-1' });
        const rows = [
            { id: 1, name: 'Alice', active: true, score: 95.5, metadata: { tier: 'gold' } },
            { id: 2, name: 'Bob', active: false, score: 82.0, metadata: { tier: 'silver' } },
        ];
        const asset = createMockAsset({
            valueType: 'array',
            value: rows,
        });

        const result = TableBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'array',
            value: rows,
            meta: { nodeId: 'table-1', portId: 'output' },
        });
    });

    it('should handle both output and origin ports consistently', () => {
        const node = createMockNode();
        const rows = [{ id: 1, name: 'Alice' }];
        const asset = createMockAsset({
            valueType: 'array',
            value: rows,
        });

        const outputResult = TableBehavior.resolveOutput!(node, asset, 'output');
        const originResult = TableBehavior.resolveOutput!(node, asset, 'origin');

        expect(outputResult?.value).toEqual(originResult?.value);
        expect(outputResult?.type).toBe(originResult?.type);
        expect(outputResult?.meta.portId).toBe('output');
        expect(originResult?.meta.portId).toBe('origin');
    });

    it('should handle table with special characters in field values', () => {
        const node = createMockNode();
        const rows = [{ id: 1, text: 'Hello "world" & <test>!' }];
        const asset = createMockAsset({
            valueType: 'array',
            value: rows,
        });

        const result = TableBehavior.resolveOutput!(node, asset, 'output');

        expect((result?.value as any[])[0].text).toBe('Hello "world" & <test>!');
    });

    it('should handle table with unicode content', () => {
        const node = createMockNode();
        const rows = [{ id: 1, name: '世界', emoji: '🌍' }];
        const asset = createMockAsset({
            valueType: 'array',
            value: rows,
        });

        const result = TableBehavior.resolveOutput!(node, asset, 'output');

        expect((result?.value as any[])[0].name).toBe('世界');
        expect((result?.value as any[])[0].emoji).toBe('🌍');
    });

    it('should preserve metadata in output port value', () => {
        const node = createMockNode({ id: 'custom-table-id' });
        const rows = [{ id: 1, name: 'Alice' }];
        const asset = createMockAsset({
            valueType: 'array',
            value: rows,
        });

        const result = TableBehavior.resolveOutput!(node, asset, 'custom-port');

        // Unknown port returns null
        expect(result).toBeNull();

        const outputResult = TableBehavior.resolveOutput!(node, asset, 'output');
        expect(outputResult?.meta).toEqual({
            nodeId: 'custom-table-id',
            portId: 'output',
        });
    });
});
