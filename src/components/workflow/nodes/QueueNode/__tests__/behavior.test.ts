/**
 * QueueBehavior Tests
 * Tests for QueueNode behavior including port resolution
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueueBehavior } from '../behavior';
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
    type: 'queue',
    position: { x: 0, y: 0 },
    data: { title: 'Test Queue' },
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

// ============================================================================
// resolveOutput Tests - output port
// ============================================================================

describe('QueueBehavior - resolveOutput - output port', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return array of results from successful tasks when asset.value is an array', () => {
        const node = createMockNode();
        const tasks = [
            { status: 'success', result: 'result1' },
            { status: 'success', result: 'result2' },
            { status: 'failed', result: 'result3' },
        ];
        const asset = createMockAsset({
            valueType: 'record',
            value: tasks,
        });

        const result = QueueBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'array',
            value: ['result1', 'result2'],
            meta: { nodeId: node.id, portId: 'output' },
        });
    });

    it('should return array of results from successful tasks when asset.value has tasks property', () => {
        const node = createMockNode();
        const tasks = [
            { status: 'success', result: { data: 'value1' } },
            { status: 'pending', result: null },
            { status: 'success', result: { data: 'value2' } },
        ];
        const asset = createMockAsset({
            valueType: 'record',
            value: { tasks },
        });

        const result = QueueBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'array',
            value: [{ data: 'value1' }, { data: 'value2' }],
            meta: { nodeId: node.id, portId: 'output' },
        });
    });

    it('should return empty array when no tasks have success status', () => {
        const node = createMockNode();
        const tasks = [
            { status: 'failed', result: 'error1' },
            { status: 'pending', result: null },
            { status: 'running', result: null },
        ];
        const asset = createMockAsset({
            valueType: 'record',
            value: tasks,
        });

        const result = QueueBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'array',
            value: [],
            meta: { nodeId: node.id, portId: 'output' },
        });
    });

    it('should return empty array when asset.value is empty array', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'record',
            value: [],
        });

        const result = QueueBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'array',
            value: [],
            meta: { nodeId: node.id, portId: 'output' },
        });
    });

    it('should return empty array when asset.value has empty tasks property', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'record',
            value: { tasks: [] },
        });

        const result = QueueBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'array',
            value: [],
            meta: { nodeId: node.id, portId: 'output' },
        });
    });

    it('should return null when asset is null', () => {
        const node = createMockNode();

        const result = QueueBehavior.resolveOutput!(node, null, 'output');

        expect(result).toBeNull();
    });

    it('should return null when asset.value is null', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'record',
            value: null as any,
        });

        const result = QueueBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toBeNull();
    });

    it('should return null when asset.value is undefined', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'record',
            value: undefined as any,
        });

        const result = QueueBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toBeNull();
    });

    it('should return empty array when asset.value is object without tasks property', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'record',
            value: { data: 'some data' },
        });

        const result = QueueBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'array',
            value: [],
            meta: { nodeId: node.id, portId: 'output' },
        });
    });

    it('should handle results with various data types', () => {
        const node = createMockNode();
        const tasks = [
            { status: 'success', result: 'string result' },
            { status: 'success', result: 42 },
            { status: 'success', result: { key: 'value' } },
            { status: 'success', result: [1, 2, 3] },
            { status: 'success', result: true },
        ];
        const asset = createMockAsset({
            valueType: 'record',
            value: tasks,
        });

        const result = QueueBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'array',
            value: ['string result', 42, { key: 'value' }, [1, 2, 3], true],
            meta: { nodeId: node.id, portId: 'output' },
        });
    });
});

// ============================================================================
// resolveOutput Tests - origin port
// ============================================================================

describe('QueueBehavior - resolveOutput - origin port', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return all tasks when asset.value is an array', () => {
        const node = createMockNode();
        const tasks = [
            { status: 'success', result: 'result1' },
            { status: 'failed', result: 'error1' },
            { status: 'pending', result: null },
        ];
        const asset = createMockAsset({
            valueType: 'record',
            value: tasks,
        });

        const result = QueueBehavior.resolveOutput!(node, asset, 'origin');

        expect(result).toEqual({
            type: 'array',
            value: tasks,
            meta: { nodeId: node.id, portId: 'origin' },
        });
    });

    it('should return all tasks when asset.value has tasks property', () => {
        const node = createMockNode();
        const tasks = [
            { id: 1, status: 'success', result: 'result1' },
            { id: 2, status: 'failed', result: 'error1' },
        ];
        const asset = createMockAsset({
            valueType: 'record',
            value: { tasks },
        });

        const result = QueueBehavior.resolveOutput!(node, asset, 'origin');

        expect(result).toEqual({
            type: 'array',
            value: tasks,
            meta: { nodeId: node.id, portId: 'origin' },
        });
    });

    it('should return empty array when asset.value is empty array', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'record',
            value: [],
        });

        const result = QueueBehavior.resolveOutput!(node, asset, 'origin');

        expect(result).toEqual({
            type: 'array',
            value: [],
            meta: { nodeId: node.id, portId: 'origin' },
        });
    });

    it('should return empty array when asset.value has empty tasks property', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'record',
            value: { tasks: [] },
        });

        const result = QueueBehavior.resolveOutput!(node, asset, 'origin');

        expect(result).toEqual({
            type: 'array',
            value: [],
            meta: { nodeId: node.id, portId: 'origin' },
        });
    });

    it('should return null when asset is null', () => {
        const node = createMockNode();

        const result = QueueBehavior.resolveOutput!(node, null, 'origin');

        expect(result).toBeNull();
    });

    it('should return null when asset.value is null', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'record',
            value: null as any,
        });

        const result = QueueBehavior.resolveOutput!(node, asset, 'origin');

        expect(result).toBeNull();
    });

    it('should return empty array when asset.value is object without tasks property', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'record',
            value: { data: 'some data' },
        });

        const result = QueueBehavior.resolveOutput!(node, asset, 'origin');

        expect(result).toEqual({
            type: 'array',
            value: [],
            meta: { nodeId: node.id, portId: 'origin' },
        });
    });
});

// ============================================================================
// resolveOutput Tests - unknown port
// ============================================================================

describe('QueueBehavior - resolveOutput - unknown port', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return null for unknown port', () => {
        const node = createMockNode();
        const tasks = [
            { status: 'success', result: 'result1' },
        ];
        const asset = createMockAsset({
            valueType: 'record',
            value: tasks,
        });

        const result = QueueBehavior.resolveOutput!(node, asset, 'unknownPort');

        expect(result).toBeNull();
    });

    it('should return null for input ports', () => {
        const node = createMockNode();
        const tasks = [
            { status: 'success', result: 'result1' },
        ];
        const asset = createMockAsset({
            valueType: 'record',
            value: tasks,
        });

        const result = QueueBehavior.resolveOutput!(node, asset, 'input');

        expect(result).toBeNull();
    });

    it('should return null for field: prefixed ports', () => {
        const node = createMockNode();
        const tasks = [
            { status: 'success', result: 'result1' },
        ];
        const asset = createMockAsset({
            valueType: 'record',
            value: tasks,
        });

        const result = QueueBehavior.resolveOutput!(node, asset, 'field:status');

        expect(result).toBeNull();
    });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('QueueBehavior - Integration scenarios', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should handle complete queue node with mixed task statuses', () => {
        const node = createMockNode();
        const tasks = [
            { id: '1', status: 'success', result: { output: 'task1' } },
            { id: '2', status: 'failed', result: { error: 'timeout' } },
            { id: '3', status: 'success', result: { output: 'task3' } },
            { id: '4', status: 'pending', result: null },
            { id: '5', status: 'success', result: { output: 'task5' } },
        ];
        const asset = createMockAsset({
            valueType: 'record',
            value: tasks,
        });

        const outputResult = QueueBehavior.resolveOutput!(node, asset, 'output');
        const originResult = QueueBehavior.resolveOutput!(node, asset, 'origin');

        expect(outputResult).toEqual({
            type: 'array',
            value: [
                { output: 'task1' },
                { output: 'task3' },
                { output: 'task5' },
            ],
            meta: { nodeId: node.id, portId: 'output' },
        });

        expect(originResult).toEqual({
            type: 'array',
            value: tasks,
            meta: { nodeId: node.id, portId: 'origin' },
        });
    });

    it('should handle tasks with null results', () => {
        const node = createMockNode();
        const tasks = [
            { status: 'success', result: null },
            { status: 'success', result: undefined },
            { status: 'success', result: 'valid' },
        ];
        const asset = createMockAsset({
            valueType: 'record',
            value: tasks,
        });

        const result = QueueBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'array',
            value: [null, undefined, 'valid'],
            meta: { nodeId: node.id, portId: 'output' },
        });
    });

    it('should differentiate between output (filtered) and origin (all) ports', () => {
        const node = createMockNode();
        const tasks = [
            { status: 'success', result: 'a' },
            { status: 'failed', result: 'b' },
            { status: 'pending', result: 'c' },
        ];
        const asset = createMockAsset({
            valueType: 'record',
            value: tasks,
        });

        const outputResult = QueueBehavior.resolveOutput!(node, asset, 'output');
        const originResult = QueueBehavior.resolveOutput!(node, asset, 'origin');

        expect(outputResult?.value).toHaveLength(1);
        expect(outputResult?.value).toEqual(['a']);

        expect(originResult?.value).toHaveLength(3);
        expect(originResult?.value).toEqual(tasks);
    });

    it('should handle object format with tasks property containing various statuses', () => {
        const node = createMockNode();
        const tasks = [
            { status: 'success', result: 'done1' },
            { status: 'running', result: null },
            { status: 'success', result: 'done2' },
        ];
        const asset = createMockAsset({
            valueType: 'record',
            value: {
                queueId: 'q-123',
                status: 'active',
                tasks,
            },
        });

        const outputResult = QueueBehavior.resolveOutput!(node, asset, 'output');
        const originResult = QueueBehavior.resolveOutput!(node, asset, 'origin');

        expect(outputResult).toEqual({
            type: 'array',
            value: ['done1', 'done2'],
            meta: { nodeId: node.id, portId: 'output' },
        });

        expect(originResult).toEqual({
            type: 'array',
            value: tasks,
            meta: { nodeId: node.id, portId: 'origin' },
        });
    });
});
