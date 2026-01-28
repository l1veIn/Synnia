// @ts-nocheck
// Graph Utils Tests
// Tests for node sanitization utilities for clipboard/duplication

import { describe, it, expect } from 'vitest';
import { sanitizeNodeForClipboard } from '../graph';
import type { SynniaNode, BaseNodeData } from '@/types/project';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockNode(overrides: Partial<SynniaNode> = {}): SynniaNode {
    return {
        id: 'node-1',
        type: 'text',
        position: { x: 100, y: 200 },
        data: {
            title: 'Test Node',
            collapsed: true,
            originalPosition: { x: 50, y: 100 },
        },
        draggable: false,
        hidden: true,
        width: 300,
        height: 200,
        style: { width: 300, height: 200, backgroundColor: 'red' },
        ...overrides,
    } as SynniaNode;
}

// ============================================================================
// sanitizeNodeForClipboard Tests
// ============================================================================

describe('sanitizeNodeForClipboard', () => {
    it('should remove transient state from node data', () => {
        const node = createMockNode({
            data: {
                title: 'Test Node',
                collapsed: true,
                originalPosition: { x: 50, y: 100 },
            },
        });

        const result = sanitizeNodeForClipboard(node);

        expect(result.data.collapsed).toBe(false);
        expect(result.data.originalPosition).toBeUndefined();
    });

    it('should preserve important node data properties', () => {
        const node = createMockNode({
            data: {
                title: 'Important Title',
                icon: 'icon-name',
                label: 'test-label',
                state: 'running',
                errorMessage: 'Error message',
                assetId: 'asset-123',
            },
        });

        const result = sanitizeNodeForClipboard(node);

        expect(result.data.title).toBe('Important Title');
        expect(result.data.icon).toBe('icon-name');
        expect(result.data.label).toBe('test-label');
        expect(result.data.state).toBe('running');
        expect(result.data.errorMessage).toBe('Error message');
        expect(result.data.assetId).toBe('asset-123');
    });

    it('should set draggable to true', () => {
        const node = createMockNode({ draggable: false });

        const result = sanitizeNodeForClipboard(node);

        expect(result.draggable).toBe(true);
    });

    it('should set hidden to false', () => {
        const node = createMockNode({ hidden: true });

        const result = sanitizeNodeForClipboard(node);

        expect(result.hidden).toBe(false);
    });

    it('should set width to undefined', () => {
        const node = createMockNode({ width: 300 });

        const result = sanitizeNodeForClipboard(node);

        expect(result.width).toBeUndefined();
    });

    it('should set height to undefined', () => {
        const node = createMockNode({ height: 200 });

        const result = sanitizeNodeForClipboard(node);

        expect(result.height).toBeUndefined();
    });

    it('should remove width and height from style', () => {
        const node = createMockNode({
            style: { width: 300, height: 200, backgroundColor: 'red' },
        });

        const result = sanitizeNodeForClipboard(node);

        expect(result.style.width).toBeUndefined();
        expect(result.style.height).toBeUndefined();
        expect(result.style.backgroundColor).toBe('red');
    });

    it('should create a deep copy of data to prevent reference sharing', () => {
        const node = createMockNode({
            data: {
                title: 'Original',
                nested: { value: 'test' },
            },
        });

        const result = sanitizeNodeForClipboard(node);

        // Modify the original node's data
        node.data.title = 'Modified';
        node.data.nested.value = 'modified';

        // Result should not be affected
        expect(result.data.title).toBe('Original');
        expect((result.data as { nested: { value: string } }).nested.value).toBe('test');
    });

    it('should preserve node id', () => {
        const node = createMockNode({ id: 'test-node-id' });

        const result = sanitizeNodeForClipboard(node);

        expect(result.id).toBe('test-node-id');
    });

    it('should preserve node type', () => {
        const node = createMockNode({ type: 'form' });

        const result = sanitizeNodeForClipboard(node);

        expect(result.type).toBe('form');
    });

    it('should preserve node position', () => {
        const node = createMockNode({ position: { x: 500, y: 750 } });

        const result = sanitizeNodeForClipboard(node);

        expect(result.position).toEqual({ x: 500, y: 750 });
    });

    it('should handle node without collapsed property', () => {
        const node = createMockNode({
            data: {
                title: 'No Collapsed',
            },
        });
        // Remove collapsed from data
        delete (node.data as Partial<BaseNodeData>).collapsed;

        const result = sanitizeNodeForClipboard(node);

        expect(result.data.collapsed).toBe(false);
    });

    it('should handle node without originalPosition property', () => {
        const node = createMockNode({
            data: {
                title: 'No OriginalPosition',
            },
        });
        delete (node.data as Partial<BaseNodeData>).originalPosition;

        const result = sanitizeNodeForClipboard(node);

        expect(result.data.originalPosition).toBeUndefined();
    });

    it('should handle empty node data', () => {
        const node = createMockNode();
        node.data = {} as BaseNodeData;

        const result = sanitizeNodeForClipboard(node);

        expect(result.data).toEqual({ collapsed: false });
    });

    it('should handle node with undefined width and height', () => {
        const node = createMockNode({
            width: undefined,
            height: undefined,
            style: { backgroundColor: 'blue' },
        });

        const result = sanitizeNodeForClipboard(node);

        expect(result.width).toBeUndefined();
        expect(result.height).toBeUndefined();
        expect(result.style.width).toBeUndefined();
        expect(result.style.height).toBeUndefined();
    });

    it('should handle node with minimal style object', () => {
        const node = createMockNode({
            style: undefined,
        });

        const result = sanitizeNodeForClipboard(node);

        expect(result.style).toBeDefined();
    });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('sanitizeNodeForClipboard integration', () => {
    it('should handle a realistic node with all properties', () => {
        const node = createMockNode({
            id: 'recipe-123',
            type: 'recipe',
            position: { x: 100, y: 100 },
            data: {
                title: 'My Recipe',
                icon: 'recipe-icon',
                label: 'my-recipe',
                state: 'success',
                errorMessage: undefined,
                collapsed: true,
                expandedWidth: 400,
                expandedHeight: 300,
                originalPosition: { x: 50, y: 50 },
                assetId: 'asset-abc',
                isReference: true,
                originalNodeId: 'node-original',
                dockedTo: 'container-node',
                layoutMode: 'rack',
                hasProductHandle: true,
            },
            draggable: false,
            hidden: true,
            selected: true,
            width: 350,
            height: 250,
            style: {
                width: 350,
                height: 250,
                backgroundColor: '#ffffff',
                border: '1px solid #ccc',
            },
        });

        const result = sanitizeNodeForClipboard(node);

        // Verify structure
        expect(result.id).toBe('recipe-123');
        expect(result.type).toBe('recipe');
        expect(result.position).toEqual({ x: 100, y: 100 });

        // Verify sanitized properties
        expect(result.draggable).toBe(true);
        expect(result.hidden).toBe(false);
        expect(result.width).toBeUndefined();
        expect(result.height).toBeUndefined();

        // Verify style
        expect(result.style.width).toBeUndefined();
        expect(result.style.height).toBeUndefined();
        expect(result.style.backgroundColor).toBe('#ffffff');
        expect(result.style.border).toBe('1px solid #ccc');

        // Verify data
        expect(result.data.title).toBe('My Recipe');
        expect(result.data.icon).toBe('recipe-icon');
        expect(result.data.label).toBe('my-recipe');
        expect(result.data.state).toBe('success');
        expect(result.data.assetId).toBe('asset-abc');
        expect(result.data.isReference).toBe(true);
        expect(result.data.originalNodeId).toBe('node-original');
        expect(result.data.dockedTo).toBe('container-node');
        expect(result.data.layoutMode).toBe('rack');
        expect(result.data.hasProductHandle).toBe(true);

        // Verify transient state removed
        expect(result.data.collapsed).toBe(false);
        expect(result.data.originalPosition).toBeUndefined();
    });

    it('should allow multiple sanitizations without side effects', () => {
        const node = createMockNode({
            data: { title: 'Original', collapsed: true },
        });

        const result1 = sanitizeNodeForClipboard(node);
        const result2 = sanitizeNodeForClipboard(result1);

        // Both results should have sanitized values
        expect(result1.data.collapsed).toBe(false);
        expect(result2.data.collapsed).toBe(false);
        expect(result1.data.title).toBe('Original');
        expect(result2.data.title).toBe('Original');
    });
});
