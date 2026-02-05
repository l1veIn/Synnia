// @ts-nocheck
/**
 * ImageBehavior Tests
 * Tests for ImageNode behavior including port resolution
 */

 

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ImageBehavior } from '../behavior';
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
    type: 'image',
    position: { x: 0, y: 0 },
    data: { title: 'Test Image' },
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

describe('ImageBehavior - resolveOutput - output port', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return json output with url from asset.src for output port', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'record',
            value: {
                src: 'https://example.com/image.jpg',
                width: 1920,
                height: 1080,
                mimeType: 'image/jpeg'
            },
        });

        const result = ImageBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'json',
            value: {
                url: 'https://example.com/image.jpg',
                width: 1920,
                height: 1080,
                mimeType: 'image/jpeg',
            },
            meta: { nodeId: node.id, portId: 'output' },
        });
    });

    it('should return json output with url from asset.src for origin port', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'record',
            value: {
                src: 'https://example.com/photo.png',
                width: 800,
                height: 600,
            },
        });

        const result = ImageBehavior.resolveOutput!(node, asset, 'origin');

        expect(result).toEqual({
            type: 'json',
            value: {
                url: 'https://example.com/photo.png',
                width: 800,
                height: 600,
                mimeType: undefined,
            },
            meta: { nodeId: node.id, portId: 'origin' },
        });
    });

    it('should use meta.width and meta.height when value dimensions are undefined', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'record',
            value: {
                src: 'https://example.com/image.jpg',
            },
            config: {
                schema: [],
                meta: { width: 1024, height: 768 },
            },
        });

        const result = ImageBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'json',
            value: {
                url: 'https://example.com/image.jpg',
                width: 1024,
                height: 768,
                mimeType: undefined,
            },
            meta: { nodeId: node.id, portId: 'output' },
        });
    });

    it('should prefer value dimensions over meta dimensions when both exist', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'record',
            value: {
                src: 'https://example.com/image.jpg',
                width: 500,
                height: 400,
            },
            config: {
                schema: [],
                meta: { width: 1920, height: 1080 },
            },
        });

        const result = ImageBehavior.resolveOutput!(node, asset, 'output');

        expect(result?.value.width).toBe(500);
        expect(result?.value.height).toBe(400);
    });

    it('should handle empty src url', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'record',
            value: {
                src: '',
                width: 100,
                height: 100,
            },
        });

        const result = ImageBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'json',
            value: {
                url: '',
                width: 100,
                height: 100,
                mimeType: undefined,
            },
            meta: { nodeId: node.id, portId: 'output' },
        });
    });

    it('should return null when asset is null', () => {
        const node = createMockNode();

        const result = ImageBehavior.resolveOutput!(node, null, 'output');

        expect(result).toBeNull();
    });

    it('should return null when asset value type is not record', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'array' as any,
            value: [],
        });

        const result = ImageBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toBeNull();
    });
});

// ============================================================================
// resolveOutput Tests - unknown port
// ============================================================================

describe('ImageBehavior - resolveOutput - unknown port', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return null for unknown port', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'record',
            value: { src: 'https://example.com/image.jpg' },
        });

        const result = ImageBehavior.resolveOutput!(node, asset, 'unknownPort');
        expect(result).toBeNull();
    });

    it('should return null for field: prefixed ports', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'record',
            value: { src: 'https://example.com/image.jpg' },
        });

        const result = ImageBehavior.resolveOutput!(node, asset, 'field:src');
        expect(result).toBeNull();
    });

    it('should return null for input ports', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'record',
            value: { src: 'https://example.com/image.jpg' },
        });

        const result = ImageBehavior.resolveOutput!(node, asset, 'input');
        expect(result).toBeNull();
    });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('ImageBehavior - Integration scenarios', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should handle complete image metadata output', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'record',
            value: {
                src: 'https://cdn.example.com/photos/test.jpg',
                width: 3840,
                height: 2160,
                mimeType: 'image/jpeg',
            },
            config: {
                schema: [],
            },
        });

        const result = ImageBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'json',
            value: {
                url: 'https://cdn.example.com/photos/test.jpg',
                width: 3840,
                height: 2160,
                mimeType: 'image/jpeg',
            },
            meta: { nodeId: node.id, portId: 'output' },
        });
    });

    it('should handle minimal image data with only src', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'record',
            value: { src: 'https://example.com/minimal.png' },
        });

        const result = ImageBehavior.resolveOutput!(node, asset, 'origin');

        expect(result).toEqual({
            type: 'json',
            value: {
                url: 'https://example.com/minimal.png',
                width: undefined,
                height: undefined,
                mimeType: undefined,
            },
            meta: { nodeId: node.id, portId: 'origin' },
        });
    });

    it('should handle image with svg mime type', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'record',
            value: {
                src: '/assets/logo.svg',
                mimeType: 'image/svg+xml',
            },
        });

        const result = ImageBehavior.resolveOutput!(node, asset, 'output');

        expect(result?.value.mimeType).toBe('image/svg+xml');
        expect(result?.value.url).toBe('/assets/logo.svg');
    });

    it('should handle image with png mime type', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'record',
            value: {
                src: '/assets/screenshot.png',
                width: 2560,
                height: 1440,
                mimeType: 'image/png',
            },
        });

        const result = ImageBehavior.resolveOutput!(node, asset, 'output');

        expect(result?.value.mimeType).toBe('image/png');
    });
});
