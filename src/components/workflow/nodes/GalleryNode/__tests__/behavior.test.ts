/**
 * GalleryBehavior Tests
 * Tests for GalleryNode behavior including port resolution
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GalleryBehavior } from '../behavior';
import type { SynniaNode } from '@/types/project';
import type { Asset } from '@/types/assets';
import type { GalleryImageRef } from '../types';

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
    type: 'gallery',
    position: { x: 0, y: 0 },
    data: { title: 'Test Gallery' },
    ...overrides,
});

const createMockAsset = (overrides: Partial<Asset> = {}): Asset => ({
    id: 'asset-1',
    valueType: 'array',
    value: [],
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

const createMockGalleryImageRefs = (count: number): GalleryImageRef[] => {
    return Array.from({ length: count }, (_, i) => ({
        id: `img-${i}`,
        mediaAssetId: `media-${i}`,
        starred: i % 2 === 0,
        caption: `Image ${i}`,
    }));
};

// ============================================================================
// resolveOutput Tests - output port
// ============================================================================

describe('GalleryBehavior - resolveOutput - output port', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return array output with GalleryImageRef[] for output port', () => {
        const node = createMockNode();
        const images = createMockGalleryImageRefs(3);
        const asset = createMockAsset({
            valueType: 'array',
            value: images,
        });

        const result = GalleryBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'array',
            value: images,
            meta: { nodeId: node.id, portId: 'output' },
        });
    });

    it('should return array output with empty array when value is empty', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'array',
            value: [],
        });

        const result = GalleryBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'array',
            value: [],
            meta: { nodeId: node.id, portId: 'output' },
        });
    });

    it('should return array output with empty array when value is not an array', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'array' as any,
            value: { notAnArray: true },
        });

        const result = GalleryBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'array',
            value: [],
            meta: { nodeId: node.id, portId: 'output' },
        });
    });

    it('should handle single image in gallery', () => {
        const node = createMockNode();
        const images: GalleryImageRef[] = [
            { id: 'single-img', mediaAssetId: 'media-1', starred: false, caption: 'Solo' },
        ];
        const asset = createMockAsset({
            valueType: 'array',
            value: images,
        });

        const result = GalleryBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'array',
            value: images,
            meta: { nodeId: node.id, portId: 'output' },
        });
        expect(result?.value).toHaveLength(1);
    });

    it('should handle gallery with starred images', () => {
        const node = createMockNode();
        const images: GalleryImageRef[] = [
            { id: 'img-1', mediaAssetId: 'media-1', starred: true },
            { id: 'img-2', mediaAssetId: 'media-2', starred: false },
            { id: 'img-3', mediaAssetId: 'media-3', starred: true },
        ];
        const asset = createMockAsset({
            valueType: 'array',
            value: images,
        });

        const result = GalleryBehavior.resolveOutput!(node, asset, 'output');

        expect(result?.value).toHaveLength(3);
        const starredCount = (result?.value as GalleryImageRef[]).filter((img) => img.starred).length;
        expect(starredCount).toBe(2);
    });

    it('should handle gallery with captions', () => {
        const node = createMockNode();
        const images: GalleryImageRef[] = [
            { id: 'img-1', mediaAssetId: 'media-1', starred: false, caption: 'Sunset' },
            { id: 'img-2', mediaAssetId: 'media-2', starred: true, caption: 'Beach' },
        ];
        const asset = createMockAsset({
            valueType: 'array',
            value: images,
        });

        const result = GalleryBehavior.resolveOutput!(node, asset, 'output');

        const galleryImages = result?.value as GalleryImageRef[];
        expect(galleryImages[0].caption).toBe('Sunset');
        expect(galleryImages[1].caption).toBe('Beach');
    });

    it('should return null when asset is null', () => {
        const node = createMockNode();

        const result = GalleryBehavior.resolveOutput!(node, null, 'output');

        expect(result).toBeNull();
    });

    it('should return null when asset value is null', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'array',
            value: null as any,
        });

        const result = GalleryBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toBeNull();
    });

    it('should return null when asset value is undefined', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'array',
            value: undefined as any,
        });

        const result = GalleryBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toBeNull();
    });
});

// ============================================================================
// resolveOutput Tests - origin port
// ============================================================================

describe('GalleryBehavior - resolveOutput - origin port', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return array output with GalleryImageRef[] for origin port', () => {
        const node = createMockNode();
        const images = createMockGalleryImageRefs(2);
        const asset = createMockAsset({
            valueType: 'array',
            value: images,
        });

        const result = GalleryBehavior.resolveOutput!(node, asset, 'origin');

        expect(result).toEqual({
            type: 'array',
            value: images,
            meta: { nodeId: node.id, portId: 'origin' },
        });
    });

    it('should return empty array for origin port when gallery is empty', () => {
        const node = createMockNode();
        const asset = createMockAsset({
            valueType: 'array',
            value: [],
        });

        const result = GalleryBehavior.resolveOutput!(node, asset, 'origin');

        expect(result).toEqual({
            type: 'array',
            value: [],
            meta: { nodeId: node.id, portId: 'origin' },
        });
    });

    it('should return null when asset is null for origin port', () => {
        const node = createMockNode();

        const result = GalleryBehavior.resolveOutput!(node, null, 'origin');

        expect(result).toBeNull();
    });
});

// ============================================================================
// resolveOutput Tests - unknown port
// ============================================================================

describe('GalleryBehavior - resolveOutput - unknown port', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return null for unknown port', () => {
        const node = createMockNode();
        const images = createMockGalleryImageRefs(2);
        const asset = createMockAsset({
            valueType: 'array',
            value: images,
        });

        const result = GalleryBehavior.resolveOutput!(node, asset, 'unknownPort');

        expect(result).toBeNull();
    });

    it('should return null for field: prefixed ports', () => {
        const node = createMockNode();
        const images = createMockGalleryImageRefs(2);
        const asset = createMockAsset({
            valueType: 'array',
            value: images,
        });

        const result = GalleryBehavior.resolveOutput!(node, asset, 'field:id');

        expect(result).toBeNull();
    });

    it('should return null for input ports', () => {
        const node = createMockNode();
        const images = createMockGalleryImageRefs(2);
        const asset = createMockAsset({
            valueType: 'array',
            value: images,
        });

        const result = GalleryBehavior.resolveOutput!(node, asset, 'input');

        expect(result).toBeNull();
    });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('GalleryBehavior - Integration scenarios', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should handle complete gallery metadata output', () => {
        const node = createMockNode({ id: 'gallery-1' });
        const images: GalleryImageRef[] = [
            { id: 'g1', mediaAssetId: 'm1', starred: true, caption: 'Mountain view' },
            { id: 'g2', mediaAssetId: 'm2', starred: false, caption: 'Ocean view' },
            { id: 'g3', mediaAssetId: 'm3', starred: true, caption: 'City view' },
        ];
        const asset = createMockAsset({
            valueType: 'array',
            value: images,
        });

        const result = GalleryBehavior.resolveOutput!(node, asset, 'output');

        expect(result).toEqual({
            type: 'array',
            value: images,
            meta: { nodeId: 'gallery-1', portId: 'output' },
        });
    });

    it('should handle gallery with minimal image refs (no caption)', () => {
        const node = createMockNode();
        const images: GalleryImageRef[] = [
            { id: 'img-1', mediaAssetId: 'media-1', starred: false },
            { id: 'img-2', mediaAssetId: 'media-2', starred: true },
        ];
        const asset = createMockAsset({
            valueType: 'array',
            value: images,
        });

        const result = GalleryBehavior.resolveOutput!(node, asset, 'origin');

        const galleryImages = result?.value as GalleryImageRef[];
        expect(galleryImages[0].caption).toBeUndefined();
        expect(galleryImages[1].caption).toBeUndefined();
    });

    it('should handle large gallery arrays', () => {
        const node = createMockNode();
        const images = createMockGalleryImageRefs(100);
        const asset = createMockAsset({
            valueType: 'array',
            value: images,
        });

        const result = GalleryBehavior.resolveOutput!(node, asset, 'output');

        expect(result?.value).toHaveLength(100);
        expect(result?.type).toBe('array');
    });

    it('should preserve image ref structure through output', () => {
        const node = createMockNode();
        const originalRef: GalleryImageRef = {
            id: 'unique-id',
            mediaAssetId: 'unique-media',
            starred: true,
            caption: 'Unique caption',
        };
        const asset = createMockAsset({
            valueType: 'array',
            value: [originalRef],
        });

        const result = GalleryBehavior.resolveOutput!(node, asset, 'output');

        const outputImages = result?.value as GalleryImageRef[];
        expect(outputImages[0]).toEqual(originalRef);
        expect(outputImages[0].id).toBe('unique-id');
        expect(outputImages[0].mediaAssetId).toBe('unique-media');
        expect(outputImages[0].starred).toBe(true);
        expect(outputImages[0].caption).toBe('Unique caption');
    });

    it('should handle gallery with mixed starred states', () => {
        const node = createMockNode();
        const images: GalleryImageRef[] = [
            { id: 'a', mediaAssetId: 'ma', starred: true },
            { id: 'b', mediaAssetId: 'mb', starred: true },
            { id: 'c', mediaAssetId: 'mc', starred: false },
            { id: 'd', mediaAssetId: 'md', starred: false },
            { id: 'e', mediaAssetId: 'me', starred: true },
        ];
        const asset = createMockAsset({
            valueType: 'array',
            value: images,
        });

        const result = GalleryBehavior.resolveOutput!(node, asset, 'output');

        const outputImages = result?.value as GalleryImageRef[];
        const starredImages = outputImages.filter((img) => img.starred);
        const unstarredImages = outputImages.filter((img) => !img.starred);
        expect(starredImages).toHaveLength(3);
        expect(unstarredImages).toHaveLength(2);
    });
});
