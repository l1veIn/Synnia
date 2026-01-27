/**
 * RecipeBehavior Tests
 * Tests for RecipeNode behavior including port resolution and connection validation
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RecipeBehavior } from '../behavior';
import type { SynniaNode, SynniaEdge } from '@/types/project';
import type { Asset, FieldDefinition } from '@/types/assets';
import type { ConnectionContext } from '@core/engine/types/behavior';

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

vi.mock('@features/recipes', () => ({
    getResolvedRecipe: vi.fn(() => null),
}));

vi.mock('@core/engine/smartResolve', () => ({
    smartResolveError: vi.fn(() => null),
}));

import { useWorkflowStore } from '@/store/workflowStore';
import { getConnectedFieldValues } from '@/hooks/useInspector';
import { getResolvedRecipe } from '@features/recipes';
import { smartResolveError } from '@core/engine/smartResolve';

// ============================================================================
// Test Helpers
// ============================================================================

const createMockNode = (overrides: Partial<SynniaNode> = {}): SynniaNode => ({
    id: 'node-1',
    type: 'recipe',
    position: { x: 0, y: 0 },
    data: { title: 'Test Recipe' },
    ...overrides,
});

const createMockAsset = (overrides: Partial<Asset> = {}): Asset => ({
    id: 'asset-1',
    valueType: 'record',
    value: {},
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
// isSystemHandle Tests
// ============================================================================

describe('RecipeBehavior - isSystemHandle', () => {
    it('should return true for null handle', () => {
        const ctx = createMockContext({
            edge: createMockEdge({ targetHandle: null }),
        });
        const result = RecipeBehavior.canConnect!(ctx);
        expect(result).toBeNull(); // System handles allow connection
    });

    it('should return true for undefined handle', () => {
        const ctx = createMockContext({
            edge: createMockEdge({ targetHandle: undefined }),
        });
        const result = RecipeBehavior.canConnect!(ctx);
        expect(result).toBeNull(); // System handles allow connection
    });

    it('should return true for "origin" handle', () => {
        const ctx = createMockContext({
            edge: createMockEdge({ targetHandle: 'origin' }),
        });
        const result = RecipeBehavior.canConnect!(ctx);
        expect(result).toBeNull(); // System handles allow connection
    });

    it('should return true for "product" handle', () => {
        const ctx = createMockContext({
            edge: createMockEdge({ targetHandle: 'product' }),
        });
        const result = RecipeBehavior.canConnect!(ctx);
        expect(result).toBeNull(); // System handles allow connection
    });

    it('should return true for "output" handle', () => {
        const ctx = createMockContext({
            edge: createMockEdge({ targetHandle: 'output' }),
        });
        const result = RecipeBehavior.canConnect!(ctx);
        expect(result).toBeNull(); // System handles allow connection
    });

    it('should return true for "trigger" handle', () => {
        const ctx = createMockContext({
            edge: createMockEdge({ targetHandle: 'trigger' }),
        });
        const result = RecipeBehavior.canConnect!(ctx);
        expect(result).toBeNull(); // System handles allow connection
    });

    it('should return true for "reference" handle', () => {
        const ctx = createMockContext({
            edge: createMockEdge({ targetHandle: 'reference' }),
        });
        const result = RecipeBehavior.canConnect!(ctx);
        expect(result).toBeNull(); // System handles allow connection
    });

    it('should return false for non-system handle', () => {
        const ctx = createMockContext({
            edge: createMockEdge({ targetHandle: 'customField' }),
            targetAsset: createMockAsset({
                config: {
                    schema: [createField({ key: 'customField', type: 'string', required: true })],
                },
            }),
            sourcePortValue: { type: 'text', value: 'test' },
        });

        vi.mocked(smartResolveError).mockReturnValue(null);

        RecipeBehavior.canConnect!(ctx);
        // Should not return null for non-system handle, calls through to smartResolveError
        expect(smartResolveError).toHaveBeenCalled();
    });
});

// ============================================================================
// getTargetFieldDefinition Tests
// ============================================================================

describe('RecipeBehavior - getTargetFieldDefinition', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should find field in asset.schema', () => {
        const schema = [createField({ key: 'field1' }), createField({ key: 'field2' })];
        const asset = createMockAsset({
            valueType: 'record',
            config: { schema },
        });
        const ctx = createMockContext({
            edge: createMockEdge({ targetHandle: 'field1' }),
            targetAsset: asset,
            sourcePortValue: { type: 'text', value: 'test' },
        });

        vi.mocked(smartResolveError).mockReturnValue(null);
        RecipeBehavior.canConnect!(ctx);

        // The function should find the field in schema
        expect(smartResolveError).toHaveBeenCalledWith('test', schema[0]);
    });

    it('should find field in config.schema when asset has runtime schema', () => {
        const schema = [createField({ key: 'name', type: 'string' })];
        const asset = createMockAsset({
            valueType: 'record',
            config: { schema },
        });
        const ctx = createMockContext({
            edge: createMockEdge({ targetHandle: 'name' }),
            targetAsset: asset,
            sourcePortValue: { type: 'text', value: 'John' },
        });

        vi.mocked(smartResolveError).mockReturnValue(null);
        RecipeBehavior.canConnect!(ctx);

        expect(smartResolveError).toHaveBeenCalledWith('John', schema[0]);
    });

    it('should fallback to registry lookup when asset schema not found', () => {
        const recipeSchema = [createField({ key: 'prompt', type: 'string' })];
        const asset = createMockAsset({
            config: { schema: [], recipeId: 'test-recipe' },
        });

        vi.mocked(getResolvedRecipe).mockReturnValue({
            id: 'test-recipe',
            inputSchema: recipeSchema,
        } as any);

        const ctx = createMockContext({
            edge: createMockEdge({ targetHandle: 'prompt' }),
            targetAsset: asset,
            sourcePortValue: { type: 'text', value: 'test prompt' },
        });

        vi.mocked(smartResolveError).mockReturnValue(null);
        RecipeBehavior.canConnect!(ctx);

        expect(getResolvedRecipe).toHaveBeenCalledWith('test-recipe');
        expect(smartResolveError).toHaveBeenCalled();
    });

    it('should return undefined when field not found', () => {
        const asset = createMockAsset({
            valueType: 'record',
            value: {},
            config: { schema: [] },
            sys: {
                name: 'Test',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                source: 'user',
                isLibraryAsset: null,
            },
        });

        const ctx = createMockContext({
            edge: createMockEdge({ targetHandle: 'nonExistent' }),
            targetAsset: asset,
            sourcePortValue: { type: 'text', value: 'test' },
        });

        vi.mocked(smartResolveError).mockReturnValue(null);
        RecipeBehavior.canConnect!(ctx);

        // When field is not found, should return error about missing field definition
        // But since we mock smartResolveError to return null, we need to check
        // that the function returned an error (not null)
    });
});

// ============================================================================
// validateCapabilityPort Tests
// ============================================================================

describe('RecipeBehavior - validateCapabilityPort', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should reject visionImage port for non-gallery nodes', () => {
        const sourceNode = createMockNode({ type: 'text' });
        const ctx = createMockContext({
            edge: createMockEdge({ targetHandle: 'model:visionImage' }),
            sourceNode,
            sourcePortValue: { type: 'json', value: {} },
            targetAsset: createMockAsset({
                config: {
                    schema: [createField({ key: 'visionImage', type: 'string' })],
                },
            }),
        });

        const result = RecipeBehavior.canConnect!(ctx);
        expect(result).toContain('Gallery node');
    });

    it('should accept visionImage port for gallery nodes', () => {
        const sourceNode = createMockNode({ type: 'gallery' });
        const ctx = createMockContext({
            edge: createMockEdge({ targetHandle: 'model:visionImage' }),
            sourceNode,
            sourcePortValue: { type: 'json', value: {} },
            targetAsset: createMockAsset({
                config: {
                    schema: [createField({ key: 'visionImage', type: 'string' })],
                },
            }),
        });

        // Capability validation passes, but we still need to mock the field lookup
        vi.mocked(smartResolveError).mockReturnValue(null);

        const result = RecipeBehavior.canConnect!(ctx);
        expect(result).toBeNull();
    });
});

// ============================================================================
// resolveOutput Tests
// ============================================================================

describe('RecipeBehavior - resolveOutput', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getConnectedFieldValues).mockReturnValue({});
    });

    it('should return null when asset has no value', () => {
        const node = createMockNode();
        const asset = createMockAsset({ value: null });

        const result = RecipeBehavior.resolveOutput!(node, asset, 'output');
        expect(result).toBeNull();
    });

    it('should return null when asset is null', () => {
        const node = createMockNode();

        const result = RecipeBehavior.resolveOutput!(node, null, 'output');
        expect(result).toBeNull();
    });

    it('should return merged value for "reference" port', () => {
        const node = createMockNode();
        const assetValue = { name: 'test', count: 42 };
        const asset = createMockAsset({ value: assetValue });

        vi.mocked(useWorkflowStore.getState).mockReturnValue({
            nodes: [node],
            edges: [],
            assets: {},
        } as any);

        const result = RecipeBehavior.resolveOutput!(node, asset, 'reference');

        expect(result).toEqual({
            type: 'json',
            value: assetValue,
            meta: { nodeId: node.id, portId: 'reference' },
        });
    });

    it('should return merged value for "origin" port', () => {
        const node = createMockNode();
        const assetValue = { data: 'value' };
        const asset = createMockAsset({ value: assetValue });

        vi.mocked(useWorkflowStore.getState).mockReturnValue({
            nodes: [node],
            edges: [],
            assets: {},
        } as any);

        const result = RecipeBehavior.resolveOutput!(node, asset, 'origin');

        expect(result).toEqual({
            type: 'json',
            value: assetValue,
            meta: { nodeId: node.id, portId: 'origin' },
        });
    });

    it('should extract field value for field: prefixed port', () => {
        const node = createMockNode();
        const assetValue = { name: 'John', age: 30 };
        const asset = createMockAsset({ value: assetValue });

        vi.mocked(useWorkflowStore.getState).mockReturnValue({
            nodes: [node],
            edges: [],
            assets: {},
        } as any);

        const result = RecipeBehavior.resolveOutput!(node, asset, 'field:name');

        expect(result).toEqual({
            type: 'text',
            value: 'John',
            meta: { nodeId: node.id, portId: 'field:name' },
        });
    });

    it('should return json type for object field value', () => {
        const node = createMockNode();
        const assetValue = { config: { key: 'value' } };
        const asset = createMockAsset({ value: assetValue });

        vi.mocked(useWorkflowStore.getState).mockReturnValue({
            nodes: [node],
            edges: [],
            assets: {},
        } as any);

        const result = RecipeBehavior.resolveOutput!(node, asset, 'field:config');

        expect(result).toEqual({
            type: 'json',
            value: { key: 'value' },
            meta: { nodeId: node.id, portId: 'field:config' },
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

        const result = RecipeBehavior.resolveOutput!(node, asset, 'field:nonExistent');
        expect(result).toBeNull();
    });

    it('should return value for direct field port (no prefix)', () => {
        const node = createMockNode();
        const assetValue = { status: 'active' };
        const asset = createMockAsset({ value: assetValue });

        vi.mocked(useWorkflowStore.getState).mockReturnValue({
            nodes: [node],
            edges: [],
            assets: {},
        } as any);

        const result = RecipeBehavior.resolveOutput!(node, asset, 'status');

        expect(result).toEqual({
            type: 'text',
            value: 'active',
            meta: { nodeId: node.id, portId: 'status' },
        });
    });

    it('should merge connected values with own values', () => {
        const node = createMockNode();
        const assetValue = { ownField: 'own' };
        const connectedValue = { connectedField: 'connected' };

        const asset = createMockAsset({ value: assetValue });

        vi.mocked(useWorkflowStore.getState).mockReturnValue({
            nodes: [node],
            edges: [],
            assets: {},
        } as any);
        vi.mocked(getConnectedFieldValues).mockReturnValue(connectedValue);

        // The merged value should include both own and connected values
        const result = RecipeBehavior.resolveOutput!(node, asset, 'reference');

        expect(result).toEqual({
            type: 'json',
            value: { ...assetValue, ...connectedValue },
            meta: { nodeId: node.id, portId: 'reference' },
        });
    });

    it('should prioritize connected values over own values when merging', () => {
        const node = createMockNode();
        const assetValue = { field: 'ownValue' };
        const connectedValue = { field: 'connectedValue' };

        const asset = createMockAsset({ value: assetValue });

        vi.mocked(useWorkflowStore.getState).mockReturnValue({
            nodes: [node],
            edges: [],
            assets: {},
        } as any);
        vi.mocked(getConnectedFieldValues).mockReturnValue(connectedValue);

        const result = RecipeBehavior.resolveOutput!(node, asset, 'field:field');

        // Connected value should override own value
        expect(result).toEqual({
            type: 'text',
            value: 'connectedValue',
            meta: { nodeId: node.id, portId: 'field:field' },
        });
    });
});

// ============================================================================
// canConnect Tests
// ============================================================================

describe('RecipeBehavior - canConnect', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should allow connection to system handles', () => {
        const systemHandles = ['origin', 'product', 'output', 'trigger', 'reference'];

        for (const handle of systemHandles) {
            const ctx = createMockContext({
                edge: createMockEdge({ targetHandle: handle }),
            });
            const result = RecipeBehavior.canConnect!(ctx);
            expect(result).toBeNull();
        }
    });

    it('should validate capability ports with model: prefix', () => {
        const sourceNode = createMockNode({ type: 'text' });
        const ctx = createMockContext({
            edge: createMockEdge({ targetHandle: 'model:visionImage' }),
            sourceNode,
            sourcePortValue: { type: 'json', value: {} },
            targetAsset: createMockAsset({
                config: { schema: [] },
            }),
        });

        const result = RecipeBehavior.canConnect!(ctx);
        expect(result).toContain('Gallery node');
    });

    it('should return error when target field definition is missing', () => {
        const asset = createMockAsset({
            valueType: 'record',
            value: {},
            config: { schema: [] },
            sys: {
                name: 'Test',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                source: 'user',
                isLibraryAsset: null,
            },
        });

        const ctx = createMockContext({
            edge: createMockEdge({ targetHandle: 'nonExistentField' }),
            targetAsset: asset,
            sourcePortValue: { type: 'text', value: 'test' },
        });

        vi.mocked(getResolvedRecipe).mockReturnValue(null);

        const result = RecipeBehavior.canConnect!(ctx);
        expect(result).toContain('Target field definition is missing');
    });

    it('should return error when source has no output data', () => {
        const ctx = createMockContext({
            edge: createMockEdge({ targetHandle: 'input' }),
            targetAsset: createMockAsset({
                config: { schema: [createField({ key: 'input', type: 'string' })] },
            }),
            sourcePortValue: null,
        });

        const result = RecipeBehavior.canConnect!(ctx);
        expect(result).toContain('Source node has no output data');
    });

    it('should return error when source port value is empty', () => {
        const ctx = createMockContext({
            edge: createMockEdge({ targetHandle: 'input' }),
            targetAsset: createMockAsset({
                config: { schema: [createField({ key: 'input', type: 'string' })] },
            }),
            sourcePortValue: { type: 'text', value: undefined },
        });

        const result = RecipeBehavior.canConnect!(ctx);
        expect(result).toContain('Source node has no output data');
    });

    it('should use smartResolve to validate connection', () => {
        const sourceValue = { name: 'Test' };
        const targetField = createField({ key: 'name', type: 'string', required: true });

        const ctx = createMockContext({
            edge: createMockEdge({ targetHandle: 'name' }),
            targetAsset: createMockAsset({
                config: { schema: [targetField] },
            }),
            sourcePortValue: { type: 'json', value: sourceValue },
        });

        vi.mocked(smartResolveError).mockReturnValue('Type mismatch');

        const result = RecipeBehavior.canConnect!(ctx);
        expect(smartResolveError).toHaveBeenCalledWith(sourceValue, targetField);
        expect(result).toBe('Type mismatch');
    });

    it('should allow connection when smartResolve passes', () => {
        const sourceValue = { name: 'Valid Name' };
        const targetField = createField({ key: 'name', type: 'string', required: true });

        const ctx = createMockContext({
            edge: createMockEdge({ targetHandle: 'name' }),
            targetAsset: createMockAsset({
                config: { schema: [targetField] },
            }),
            sourcePortValue: { type: 'json', value: sourceValue },
        });

        vi.mocked(smartResolveError).mockReturnValue(null);

        const result = RecipeBehavior.canConnect!(ctx);
        expect(result).toBeNull();
    });
});

// ============================================================================
// onConnect Tests
// ============================================================================

describe('RecipeBehavior - onConnect', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return null (no auto-fill by default)', () => {
        const ctx = createMockContext();

        const result = RecipeBehavior.onConnect!(ctx);
        expect(result).toBeNull();
    });

    it('should handle connection without modifying state', () => {
        const sourceNode = createMockNode({ id: 'source', type: 'text' });
        const targetNode = createMockNode({ id: 'target', type: 'recipe' });
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

        const result = RecipeBehavior.onConnect!(ctx);
        expect(result).toBeNull();
    });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('RecipeBehavior - Integration scenarios', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should handle complete connection flow for text to recipe', () => {
        const textNode = createMockNode({ id: 'text-1', type: 'text' });
        const recipeNode = createMockNode({ id: 'recipe-1', type: 'recipe' });

        const textAsset = createMockAsset({ value: { text: 'Hello World' } });
        const recipeAsset = createMockAsset({
            value: {},
            config: {
                schema: [createField({ key: 'prompt', type: 'string', required: true })],
            },
        });

        const ctx = createMockContext({
            sourceNode: textNode,
            targetNode: recipeNode,
            sourceAsset: textAsset,
            targetAsset: recipeAsset,
            edge: createMockEdge({ targetHandle: 'prompt' }),
            sourcePortValue: { type: 'text', value: 'Hello World' },
        });

        vi.mocked(smartResolveError).mockReturnValue(null);

        const canConnectResult = RecipeBehavior.canConnect!(ctx);
        expect(canConnectResult).toBeNull();

        const onConnectResult = RecipeBehavior.onConnect!(ctx);
        expect(onConnectResult).toBeNull();
    });

    it('should reject incompatible types', () => {
        const galleryNode = createMockNode({ id: 'gallery-1', type: 'gallery' });
        const recipeNode = createMockNode({ id: 'recipe-1', type: 'recipe' });

        const galleryAsset = createMockAsset({ valueType: 'array', value: [] });
        const recipeAsset = createMockAsset({
            value: {},
            config: {
                schema: [createField({ key: 'singleImage', type: 'object', required: true })],
            },
        });

        const ctx = createMockContext({
            sourceNode: galleryNode,
            targetNode: recipeNode,
            sourceAsset: galleryAsset,
            targetAsset: recipeAsset,
            edge: createMockEdge({ targetHandle: 'singleImage' }),
            sourcePortValue: { type: 'array', value: [] },
        });

        vi.mocked(smartResolveError).mockReturnValue('Array cannot be used for object field');

        const result = RecipeBehavior.canConnect!(ctx);
        expect(result).toContain('Array cannot be used');
    });

    it('should resolve output with connected values', () => {
        const recipeNode = createMockNode({ id: 'recipe-1', type: 'recipe' });
        const upstreamValue = { prompt: 'from upstream' };

        const recipeAsset = createMockAsset({
            value: { ownField: 'own value' },
            config: { schema: [] },
        });

        vi.mocked(useWorkflowStore.getState).mockReturnValue({
            nodes: [recipeNode],
            edges: [],
            assets: {},
        } as any);
        vi.mocked(getConnectedFieldValues).mockReturnValue(upstreamValue);

        const result = RecipeBehavior.resolveOutput!(recipeNode, recipeAsset, 'origin');

        expect(result).toEqual({
            type: 'json',
            value: { ownField: 'own value', prompt: 'from upstream' },
            meta: { nodeId: 'recipe-1', portId: 'origin' },
        });
    });

    it('should handle vision capability validation correctly', () => {
        const textNode = createMockNode({ id: 'text-1', type: 'text' });
        const recipeNode = createMockNode({ id: 'recipe-1', type: 'recipe' });

        const textAsset = createMockAsset({ value: { text: 'text data' } });
        const recipeAsset = createMockAsset({
            value: {},
            config: { schema: [] },
        });

        const ctx = createMockContext({
            sourceNode: textNode,
            targetNode: recipeNode,
            sourceAsset: textAsset,
            targetAsset: recipeAsset,
            edge: createMockEdge({ targetHandle: 'model:visionImage' }),
            sourcePortValue: { type: 'text', value: 'text data' },
        });

        const result = RecipeBehavior.canConnect!(ctx);
        expect(result).toContain('Gallery node');
    });
});
