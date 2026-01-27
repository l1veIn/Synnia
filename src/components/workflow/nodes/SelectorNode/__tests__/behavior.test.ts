/**
 * SelectorBehavior Tests
 * Tests for SelectorNode behavior including port resolution
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SelectorBehavior } from '../behavior';
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
    type: 'selector',
    position: { x: 0, y: 0 },
    data: { title: 'Test Selector' },
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
// resolveOutput Tests - output port (V3 format)
// ============================================================================

describe('SelectorBehavior - resolveOutput - output port (V3 format)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return selected items from asset.value array with node.data.selected', () => {
        const node = createMockNode({
            data: { selected: ['item-1', 'item-3'] },
        });
        const items = [
            { id: 'item-1', name: 'Option 1' },
            { id: 'item-2', name: 'Option 2' },
            { id: 'item-3', name: 'Option 3' },
        ];
        const asset = createMockAsset({
            valueType: 'array',
            value: items,
        });

        const result = SelectorBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'array',
            value: [{ id: 'item-1', name: 'Option 1' }, { id: 'item-3', name: 'Option 3' }],
            meta: { nodeId: node.id, portId: 'output' },
        });
    });

    it('should return empty array when no items are selected', () => {
        const node = createMockNode({
            data: { selected: [] },
        });
        const items = [
            { id: 'item-1', name: 'Option 1' },
            { id: 'item-2', name: 'Option 2' },
        ];
        const asset = createMockAsset({
            valueType: 'array',
            value: items,
        });

        const result = SelectorBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'array',
            value: [],
            meta: { nodeId: node.id, portId: 'output' },
        });
    });

    it('should return empty array when selected IDs do not match any items', () => {
        const node = createMockNode({
            data: { selected: ['unknown-1', 'unknown-2'] },
        });
        const items = [
            { id: 'item-1', name: 'Option 1' },
        ];
        const asset = createMockAsset({
            valueType: 'array',
            value: items,
        });

        const result = SelectorBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'array',
            value: [],
            meta: { nodeId: node.id, portId: 'output' },
        });
    });

    it('should handle empty asset.value array', () => {
        const node = createMockNode({
            data: { selected: [] },
        });
        const asset = createMockAsset({
            valueType: 'array',
            value: [],
        });

        const result = SelectorBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'array',
            value: [],
            meta: { nodeId: node.id, portId: 'output' },
        });
    });

    it('should return null when asset is null', () => {
        const node = createMockNode();

        const result = SelectorBehavior.resolveOutput!(node, null, 'output');

        expect(result).toBeNull();
    });

    it('should return null when asset.value is falsy', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'array',
            value: null as any,
        });

        const result = SelectorBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toBeNull();
    });

    it('should handle node.data without selected property (default to empty array)', () => {
        const node = createMockNode({
            data: {},
        });
        const items = [
            { id: 'item-1', name: 'Option 1' },
        ];
        const asset = createMockAsset({
            valueType: 'array',
            value: items,
        });

        const result = SelectorBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'array',
            value: [],
            meta: { nodeId: node.id, portId: 'output' },
        });
    });
});

// ============================================================================
// resolveOutput Tests - output port (Legacy format)
// ============================================================================

describe('SelectorBehavior - resolveOutput - output port (Legacy format)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return selected items from legacy asset.value.options and asset.value.selected', () => {
        const node = createMockNode();
        const items = [
            { id: 'opt-1', label: 'Choice 1' },
            { id: 'opt-2', label: 'Choice 2' },
            { id: 'opt-3', label: 'Choice 3' },
        ];
        const asset = createMockAsset({
            valueType: 'array',
            value: {
                options: items,
                selected: ['opt-1', 'opt-3'],
            },
        });

        const result = SelectorBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'array',
            value: [{ id: 'opt-1', label: 'Choice 1' }, { id: 'opt-3', label: 'Choice 3' }],
            meta: { nodeId: node.id, portId: 'output' },
        });
    });

    it('should handle legacy format with empty options', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'array',
            value: {
                options: [],
                selected: [],
            },
        });

        const result = SelectorBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'array',
            value: [],
            meta: { nodeId: node.id, portId: 'output' },
        });
    });

    it('should handle legacy format with missing options property', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'array',
            value: {
                selected: ['opt-1'],
            },
        });

        const result = SelectorBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'array',
            value: [],
            meta: { nodeId: node.id, portId: 'output' },
        });
    });

    it('should handle legacy format with missing selected property', () => {
        const node = createMockNode();
        const items = [
            { id: 'opt-1', label: 'Choice 1' },
        ];
        const asset = createMockAsset({
            valueType: 'array',
            value: {
                options: items,
            },
        });

        const result = SelectorBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'array',
            value: [],
            meta: { nodeId: node.id, portId: 'output' },
        });
    });
});

// ============================================================================
// resolveOutput Tests - origin port
// ============================================================================

describe('SelectorBehavior - resolveOutput - origin port', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return all items from asset.value array for origin port (V3 format)', () => {
        const node = createMockNode({
            data: { selected: ['item-1'] },
        });
        const items = [
            { id: 'item-1', name: 'Option 1' },
            { id: 'item-2', name: 'Option 2' },
            { id: 'item-3', name: 'Option 3' },
        ];
        const asset = createMockAsset({
            valueType: 'array',
            value: items,
        });

        const result = SelectorBehavior.resolveOutput!(node, asset, 'origin');

        expect(result).toEqual({
            type: 'array',
            value: items,
            meta: { nodeId: node.id, portId: 'origin' },
        });
    });

    it('should return all items from asset.value.options for origin port (Legacy format)', () => {
        const node = createMockNode();
        const items = [
            { id: 'opt-1', label: 'Choice 1' },
            { id: 'opt-2', label: 'Choice 2' },
        ];
        const asset = createMockAsset({
            valueType: 'array',
            value: {
                options: items,
                selected: ['opt-1'],
            },
        });

        const result = SelectorBehavior.resolveOutput!(node, asset, 'origin');

        expect(result).toEqual({
            type: 'array',
            value: items,
            meta: { nodeId: node.id, portId: 'origin' },
        });
    });

    it('should return empty array for origin port when no items exist', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'array',
            value: [],
        });

        const result = SelectorBehavior.resolveOutput!(node, asset, 'origin');

        expect(result).toEqual({
            type: 'array',
            value: [],
            meta: { nodeId: node.id, portId: 'origin' },
        });
    });

    it('should return null when asset is null for origin port', () => {
        const node = createMockNode();

        const result = SelectorBehavior.resolveOutput!(node, null, 'origin');

        expect(result).toBeNull();
    });
});

// ============================================================================
// resolveOutput Tests - field: prefixed ports
// ============================================================================

describe('SelectorBehavior - resolveOutput - field: prefixed ports', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should extract field value from first selected item (V3 format)', () => {
        const node = createMockNode({
            data: { selected: ['item-1', 'item-2'] },
        });
        const items = [
            { id: 'item-1', name: 'First', value: 100 },
            { id: 'item-2', name: 'Second', value: 200 },
        ];
        const asset = createMockAsset({
            valueType: 'array',
            value: items,
        });

        const result = SelectorBehavior.resolveOutput!(node, asset, 'field:name');

        expect(result).toEqual({
            type: 'text',
            value: 'First',
            meta: { nodeId: node.id, portId: 'field:name' },
        });
    });

    it('should return json type for object field values', () => {
        const node = createMockNode({
            data: { selected: ['item-1'] },
        });
        const items = [
            { id: 'item-1', metadata: { key: 'value', count: 5 } },
        ];
        const asset = createMockAsset({
            valueType: 'array',
            value: items,
        });

        const result = SelectorBehavior.resolveOutput!(node, asset, 'field:metadata');

        expect(result).toEqual({
            type: 'json',
            value: { key: 'value', count: 5 },
            meta: { nodeId: node.id, portId: 'field:metadata' },
        });
    });

    it('should return null when field does not exist on selected item', () => {
        const node = createMockNode({
            data: { selected: ['item-1'] },
        });
        const items = [
            { id: 'item-1', name: 'First' },
        ];
        const asset = createMockAsset({
            valueType: 'array',
            value: items,
        });

        const result = SelectorBehavior.resolveOutput!(node, asset, 'field:nonExistent');

        expect(result).toBeNull();
    });

    it('should return null when field value is undefined', () => {
        const node = createMockNode({
            data: { selected: ['item-1'] },
        });
        const items = [
            { id: 'item-1', name: 'First', optional: undefined },
        ];
        const asset = createMockAsset({
            valueType: 'array',
            value: items,
        });

        const result = SelectorBehavior.resolveOutput!(node, asset, 'field:optional');

        expect(result).toBeNull();
    });

    it('should return null when no items are selected for field port', () => {
        const node = createMockNode({
            data: { selected: [] },
        });
        const items = [
            { id: 'item-1', name: 'First' },
        ];
        const asset = createMockAsset({
            valueType: 'array',
            value: items,
        });

        const result = SelectorBehavior.resolveOutput!(node, asset, 'field:name');

        expect(result).toBeNull();
    });

    it('should handle field with numeric value', () => {
        const node = createMockNode({
            data: { selected: ['item-1'] },
        });
        const items = [
            { id: 'item-1', name: 'First', count: 42 },
        ];
        const asset = createMockAsset({
            valueType: 'array',
            value: items,
        });

        const result = SelectorBehavior.resolveOutput!(node, asset, 'field:count');

        expect(result).toEqual({
            type: 'text',
            value: 42,
            meta: { nodeId: node.id, portId: 'field:count' },
        });
    });

    it('should handle field with boolean value', () => {
        const node = createMockNode({
            data: { selected: ['item-1'] },
        });
        const items = [
            { id: 'item-1', name: 'First', active: true },
        ];
        const asset = createMockAsset({
            valueType: 'array',
            value: items,
        });

        const result = SelectorBehavior.resolveOutput!(node, asset, 'field:active');

        expect(result).toEqual({
            type: 'text',
            value: true,
            meta: { nodeId: node.id, portId: 'field:active' },
        });
    });

    it('should extract field from legacy format', () => {
        const node = createMockNode();
        const items = [
            { id: 'opt-1', label: 'Choice 1', value: 'A' },
        ];
        const asset = createMockAsset({
            valueType: 'array',
            value: {
                options: items,
                selected: ['opt-1'],
            },
        });

        const result = SelectorBehavior.resolveOutput!(node, asset, 'field:value');

        expect(result).toEqual({
            type: 'text',
            value: 'A',
            meta: { nodeId: node.id, portId: 'field:value' },
        });
    });
});

// ============================================================================
// resolveOutput Tests - unknown port
// ============================================================================

describe('SelectorBehavior - resolveOutput - unknown port', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return null for unknown port', () => {
        const node = createMockNode({
            data: { selected: ['item-1'] },
        });
        const items = [{ id: 'item-1', name: 'First' }];
        const asset = createMockAsset({
            valueType: 'array',
            value: items,
        });

        const result = SelectorBehavior.resolveOutput!(node, asset, 'unknownPort');

        expect(result).toBeNull();
    });

    it('should return null for input ports', () => {
        const node = createMockNode();
        const items = [{ id: 'item-1', name: 'First' }];
        const asset = createMockAsset({
            valueType: 'array',
            value: items,
        });

        const result = SelectorBehavior.resolveOutput!(node, asset, 'input');

        expect(result).toBeNull();
    });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('SelectorBehavior - Integration scenarios', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should handle complete selector node with multiple selections', () => {
        const node = createMockNode({
            data: { selected: ['item-1', 'item-3', 'item-5'] },
        });
        const items = [
            { id: 'item-1', name: 'Option 1', value: 'a' },
            { id: 'item-2', name: 'Option 2', value: 'b' },
            { id: 'item-3', name: 'Option 3', value: 'c' },
            { id: 'item-4', name: 'Option 4', value: 'd' },
            { id: 'item-5', name: 'Option 5', value: 'e' },
        ];
        const asset = createMockAsset({
            valueType: 'array',
            value: items,
        });

        const outputResult = SelectorBehavior.resolveOutput!(node, asset, 'output');
        const originResult = SelectorBehavior.resolveOutput!(node, asset, 'origin');

        expect(outputResult).toEqual({
            type: 'array',
            value: [
                { id: 'item-1', name: 'Option 1', value: 'a' },
                { id: 'item-3', name: 'Option 3', value: 'c' },
                { id: 'item-5', name: 'Option 5', value: 'e' },
            ],
            meta: { nodeId: node.id, portId: 'output' },
        });

        expect(originResult).toEqual({
            type: 'array',
            value: items,
            meta: { nodeId: node.id, portId: 'origin' },
        });
    });

    it('should handle single selection vs multiple selections consistently', () => {
        const nodeSingle = createMockNode({
            id: 'node-single',
            data: { selected: ['item-2'] },
        });
        const nodeMulti = createMockNode({
            id: 'node-multi',
            data: { selected: ['item-1', 'item-2', 'item-3'] },
        });
        const items = [
            { id: 'item-1', name: 'First' },
            { id: 'item-2', name: 'Second' },
            { id: 'item-3', name: 'Third' },
        ];
        const asset = createMockAsset({
            valueType: 'array',
            value: items,
        });

        const singleResult = SelectorBehavior.resolveOutput!(nodeSingle, asset, 'output');
        const multiResult = SelectorBehavior.resolveOutput!(nodeMulti, asset, 'output');

        expect(singleResult?.value).toEqual([{ id: 'item-2', name: 'Second' }]);
        expect(multiResult?.value).toEqual(items);
    });

    it('should differentiate between output (selected) and origin (all) ports', () => {
        const node = createMockNode({
            data: { selected: ['item-2'] },
        });
        const items = [
            { id: 'item-1', name: 'First' },
            { id: 'item-2', name: 'Second' },
            { id: 'item-3', name: 'Third' },
        ];
        const asset = createMockAsset({
            valueType: 'array',
            value: items,
        });

        const outputResult = SelectorBehavior.resolveOutput!(node, asset, 'output');
        const originResult = SelectorBehavior.resolveOutput!(node, asset, 'origin');

        expect(outputResult?.value).toHaveLength(1);
        expect(outputResult?.value).toEqual([{ id: 'item-2', name: 'Second' }]);

        expect(originResult?.value).toHaveLength(3);
        expect(originResult?.value).toEqual(items);
    });

    it('should handle field extraction with complex nested objects', () => {
        const node = createMockNode({
            data: { selected: ['item-1'] },
        });
        const items = [
            {
                id: 'item-1',
                name: 'First',
                config: {
                    nested: { deep: 'value' },
                    array: [1, 2, 3],
                },
            },
        ];
        const asset = createMockAsset({
            valueType: 'array',
            value: items,
        });

        const configResult = SelectorBehavior.resolveOutput!(node, asset, 'field:config');

        expect(configResult).toEqual({
            type: 'json',
            value: {
                nested: { deep: 'value' },
                array: [1, 2, 3],
            },
            meta: { nodeId: node.id, portId: 'field:config' },
        });
    });

    it('should handle both V3 and legacy formats consistently for same data', () => {
        const nodeV3 = createMockNode({
            id: 'node-v3',
            data: { selected: ['item-1', 'item-2'] },
        });
        const nodeLegacy = createMockNode({
            id: 'node-legacy',
            data: {},
        });

        const items = [
            { id: 'item-1', name: 'First' },
            { id: 'item-2', name: 'Second' },
            { id: 'item-3', name: 'Third' },
        ];

        const assetV3 = createMockAsset({
            valueType: 'array',
            value: items,
        });

        const assetLegacy = createMockAsset({
            valueType: 'array',
            value: {
                options: items,
                selected: ['item-1', 'item-2'],
            },
        });

        const v3Result = SelectorBehavior.resolveOutput!(nodeV3, assetV3, 'output');
        const legacyResult = SelectorBehavior.resolveOutput!(nodeLegacy, assetLegacy, 'output');

        expect(v3Result?.value).toEqual(legacyResult?.value);
        expect(v3Result?.type).toBe(legacyResult?.type);
    });

    it('should handle items with id property of different types', () => {
        const node = createMockNode({
            data: { selected: [1, '2', 3] },
        });
        const items = [
            { id: 1, name: 'Numeric ID 1' },
            { id: '2', name: 'String ID 2' },
            { id: 3, name: 'Numeric ID 3' },
            { id: 4, name: 'Numeric ID 4' },
        ];
        const asset = createMockAsset({
            valueType: 'array',
            value: items,
        });

        const result = SelectorBehavior.resolveOutput!(node, asset, 'output');

        expect(result?.value).toEqual([
            { id: 1, name: 'Numeric ID 1' },
            { id: '2', name: 'String ID 2' },
            { id: 3, name: 'Numeric ID 3' },
        ]);
    });
});
