// @ts-nocheck
/**
 * TextBehavior Tests
 * Tests for TextNode behavior including port resolution
 */

 

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TextBehavior } from '../behavior';
import type { SynniaNode } from '@/presentation/types/project';
import type { Asset } from '@/domain/asset/types';

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
    type: 'text',
    position: { x: 0, y: 0 },
    data: { title: 'Test Text' },
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

describe('TextBehavior - resolveOutput - output port', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return text output with content from asset.value.content for output port', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'record',
            value: {
                content: 'Hello, World!',
            },
        });

        const result = TextBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'text',
            value: 'Hello, World!',
            meta: { nodeId: node.id, portId: 'output' },
        });
    });

    it('should return text output with content from asset.value.content for origin port', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'record',
            value: {
                content: 'Sample text content',
            },
        });

        const result = TextBehavior.resolveOutput!(node, asset, 'origin');

        expect(result).toEqual({
            type: 'text',
            value: 'Sample text content',
            meta: { nodeId: node.id, portId: 'origin' },
        });
    });

    it('should return empty string when asset.value.content is undefined', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'record',
            value: {},
        });

        const result = TextBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'text',
            value: '',
            meta: { nodeId: node.id, portId: 'output' },
        });
    });

    it('should return empty string when asset.value is null', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'record',
            value: null as any,
        });

        const result = TextBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'text',
            value: '',
            meta: { nodeId: node.id, portId: 'output' },
        });
    });

    it('should return empty string when asset is null', () => {
        const node = createMockNode();

        const result = TextBehavior.resolveOutput!(node, null, 'output');

        expect(result).toEqual({
            type: 'text',
            value: '',
            meta: { nodeId: node.id, portId: 'output' },
        });
    });

    it('should handle multiline text content', () => {
        const node = createMockNode();
        const multilineContent = 'Line 1\nLine 2\nLine 3';
        const asset = createMockAsset({
            valueType: 'record',
            value: {
                content: multilineContent,
            },
        });

        const result = TextBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'text',
            value: multilineContent,
            meta: { nodeId: node.id, portId: 'output' },
        });
    });

    it('should handle empty string content', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'record',
            value: {
                content: '',
            },
        });

        const result = TextBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'text',
            value: '',
            meta: { nodeId: node.id, portId: 'output' },
        });
    });

    it('should handle whitespace-only content', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'record',
            value: {
                content: '   \n\t  ',
            },
        });

        const result = TextBehavior.resolveOutput!(node, asset, 'output');

        expect(result?.value).toBe('   \n\t  ');
    });

    it('should handle special characters in content', () => {
        const node = createMockNode();
        const specialContent = 'Hello "world" & <test>!';
        const asset = createMockAsset({
            valueType: 'record',
            value: {
                content: specialContent,
            },
        });

        const result = TextBehavior.resolveOutput!(node, asset, 'output');

        expect(result?.value).toBe(specialContent);
    });

    it('should handle unicode content', () => {
        const node = createMockNode();
        const unicodeContent = 'Hello 世界 🌍';
        const asset = createMockAsset({
            valueType: 'record',
            value: {
                content: unicodeContent,
            },
        });

        const result = TextBehavior.resolveOutput!(node, asset, 'output');

        expect(result?.value).toBe(unicodeContent);
    });
});

// ============================================================================
// resolveOutput Tests - unknown port
// ============================================================================

describe('TextBehavior - resolveOutput - unknown port', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return null for unknown port', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'record',
            value: { content: 'test content' },
        });

        const result = TextBehavior.resolveOutput!(node, asset, 'unknownPort');
        expect(result).toBeNull();
    });

    it('should return null for input ports', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'record',
            value: { content: 'test content' },
        });

        const result = TextBehavior.resolveOutput!(node, asset, 'input');
        expect(result).toBeNull();
    });

    it('should return null for field: prefixed ports', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'record',
            value: { content: 'test content' },
        });

        const result = TextBehavior.resolveOutput!(node, asset, 'field:content');
        expect(result).toBeNull();
    });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('TextBehavior - Integration scenarios', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should handle complete text node with various content types', () => {
        const node = createMockNode();
        const longContent = 'This is a longer piece of text that might be used as a prompt or template. '.repeat(5);

        const asset = createMockAsset({
            valueType: 'record',
            value: {
                content: longContent,
            },
        });

        const result = TextBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'text',
            value: longContent,
            meta: { nodeId: node.id, portId: 'output' },
        });
    });

    it('should handle both output and origin ports consistently', () => {
        const node = createMockNode();
        const content = 'Consistent content';
        const asset = createMockAsset({
            valueType: 'record',
            value: { content },
        });

        const outputResult = TextBehavior.resolveOutput!(node, asset, 'output');
        const originResult = TextBehavior.resolveOutput!(node, asset, 'origin');

        expect(outputResult?.value).toBe(originResult?.value);
        expect(outputResult?.type).toBe(originResult?.type);
        expect(outputResult?.meta.portId).toBe('output');
        expect(originResult?.meta.portId).toBe('origin');
    });

    it('should handle JSON string content', () => {
        const node = createMockNode();
        const jsonContent = '{"key": "value", "number": 42}';
        const asset = createMockAsset({
            valueType: 'record',
            value: {
                content: jsonContent,
            },
        });

        const result = TextBehavior.resolveOutput!(node, asset, 'output');

        expect(result?.type).toBe('text');
        expect(result?.value).toBe(jsonContent);
    });

    it('should handle template content with placeholders', () => {
        const node = createMockNode();
        const templateContent = 'Hello {{name}}, your score is {{score}}!';
        const asset = createMockAsset({
            valueType: 'record',
            value: {
                content: templateContent,
            },
        });

        const result = TextBehavior.resolveOutput!(node, asset, 'output');

        expect(result?.value).toBe(templateContent);
    });
});
