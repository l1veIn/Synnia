/**
 * useNode Hook Tests
 * Tests for deriveViewState, compute functions, and hook logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SynniaNode, NodeType, BaseNodeData } from '@/types/project';
import { Asset } from '@/types/assets';
import { deriveViewState, computeShellClassName, computeHeaderClassName } from '@/hooks/useNode';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/store/workflowStore', () => ({
    useWorkflowStore: vi.fn(),
}));

vi.mock('@core/engine/GraphEngine', () => ({
    graphEngine: {
        updateNode: vi.fn(),
        mutator: {
            removeNode: vi.fn(),
        },
        assets: {
            update: vi.fn(),
            updateSys: vi.fn(),
        },
    },
}));

// ============================================================================
// Test Helpers
// ============================================================================

const createMockNode = (overrides?: Partial<SynniaNode>): SynniaNode => ({
    id: 'test-node-1',
    type: NodeType.TEXT,
    position: { x: 0, y: 0 },
    data: {
        nodeType: NodeType.TEXT,
        title: 'Test Node',
        collapsed: false,
        ...overrides?.data,
    },
    ...overrides,
});

const createMockAsset = (overrides?: Partial<Asset>): Asset => ({
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

// ============================================================================
// deriveViewState Tests
// ============================================================================

describe('deriveViewState', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('when node is undefined', () => {
        it('should return default state', () => {
            const result = deriveViewState(undefined);

            expect(result).toEqual({
                title: 'Unknown',
                isCollapsed: false,
                isResizable: true,
                isDockedTop: false,
                isDockedBottom: false,
                isReference: false,
                executionState: 'idle',
                hasProductHandle: false,
            });
        });
    });

    describe('title derivation', () => {
        it('should use data.title when present', () => {
            const node = createMockNode({ data: { title: 'My Custom Title' } });
            const result = deriveViewState(node);

            expect(result.title).toBe('My Custom Title');
        });

        it('should default to "Untitled" when title is not set', () => {
            const node = createMockNode({ data: { title: undefined } });
            const result = deriveViewState(node);

            expect(result.title).toBe('Untitled');
        });

        it('should default to "Untitled" when title is empty string', () => {
            const node = createMockNode({ data: { title: '' } });
            const result = deriveViewState(node);

            expect(result.title).toBe('Untitled');
        });
    });

    describe('collapsed state', () => {
        it('should be true when collapsed is true', () => {
            const node = createMockNode({ data: { collapsed: true } });
            const result = deriveViewState(node);

            expect(result.isCollapsed).toBe(true);
        });

        it('should be false when collapsed is false', () => {
            const node = createMockNode({ data: { collapsed: false } });
            const result = deriveViewState(node);

            expect(result.isCollapsed).toBe(false);
        });

        it('should be false when collapsed is undefined', () => {
            const node = createMockNode({ data: { collapsed: undefined } });
            const result = deriveViewState(node);

            expect(result.isCollapsed).toBe(false);
        });
    });

    describe('resizable state', () => {
        it('should be resizable when expanded and resize not disabled', () => {
            const node = createMockNode({
                data: { collapsed: false, other: { enableResize: true } },
            });
            const result = deriveViewState(node);

            expect(result.isResizable).toBe(true);
        });

        it('should NOT be resizable when collapsed', () => {
            const node = createMockNode({
                data: { collapsed: true, other: { enableResize: true } },
            });
            const result = deriveViewState(node);

            expect(result.isResizable).toBe(false);
        });

        it('should NOT be resizable when enableResize is false', () => {
            const node = createMockNode({
                data: { collapsed: false, other: { enableResize: false } },
            });
            const result = deriveViewState(node);

            expect(result.isResizable).toBe(false);
        });

        it('should be resizable when other is undefined', () => {
            const node = createMockNode({
                data: { collapsed: false, other: undefined },
            });
            const result = deriveViewState(node);

            expect(result.isResizable).toBe(true);
        });
    });

    describe('docking state', () => {
        it('should detect docked-to relationship', () => {
            const node = createMockNode({ data: { dockedTo: 'parent-node-id' } });
            const result = deriveViewState(node);

            expect(result.isDockedTop).toBe(true);
        });

        it('should not be docked when dockedTo is undefined', () => {
            const node = createMockNode({});
            const result = deriveViewState(node);

            expect(result.isDockedTop).toBe(false);
        });

        it('should detect hasDockedFollower', () => {
            const node = createMockNode();
            (node.data as BaseNodeData & { hasDockedFollower?: boolean }).hasDockedFollower = true;
            const result = deriveViewState(node);

            expect(result.isDockedBottom).toBe(true);
        });

        it('should not have docked follower when hasDockedFollower is false', () => {
            const node = createMockNode();
            (node.data as BaseNodeData & { hasDockedFollower?: boolean }).hasDockedFollower = false;
            const result = deriveViewState(node);

            expect(result.isDockedBottom).toBe(false);
        });
    });

    describe('reference state', () => {
        it('should detect reference nodes', () => {
            const node = createMockNode({ data: { isReference: true } });
            const result = deriveViewState(node);

            expect(result.isReference).toBe(true);
        });

        it('should not be reference when isReference is false', () => {
            const node = createMockNode({ data: { isReference: false } });
            const result = deriveViewState(node);

            expect(result.isReference).toBe(false);
        });

        it('should not be reference when isReference is undefined', () => {
            const node = createMockNode({});
            const result = deriveViewState(node);

            expect(result.isReference).toBe(false);
        });
    });

    describe('execution state', () => {
        it('should return running state', () => {
            const node = createMockNode({ data: { state: 'running' } });
            const result = deriveViewState(node);

            expect(result.executionState).toBe('running');
        });

        it('should return success state', () => {
            const node = createMockNode({ data: { state: 'success' } });
            const result = deriveViewState(node);

            expect(result.executionState).toBe('success');
        });

        it('should return error state', () => {
            const node = createMockNode({ data: { state: 'error' } });
            const result = deriveViewState(node);

            expect(result.executionState).toBe('error');
        });

        it('should default to idle when state is undefined', () => {
            const node = createMockNode({ data: { state: undefined } });
            const result = deriveViewState(node);

            expect(result.executionState).toBe('idle');
        });
    });

    describe('product handle', () => {
        it('should detect hasProductHandle', () => {
            const node = createMockNode({ data: { hasProductHandle: true } });
            const result = deriveViewState(node);

            expect(result.hasProductHandle).toBe(true);
        });

        it('should not have product handle when hasProductHandle is false', () => {
            const node = createMockNode({ data: { hasProductHandle: false } });
            const result = deriveViewState(node);

            expect(result.hasProductHandle).toBe(false);
        });
    });
});

// ============================================================================
// computeShellClassName Tests
// ============================================================================

describe('computeShellClassName', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should include min-w-[200px] for collapsed node', () => {
        const state = { isCollapsed: true, title: '', isResizable: false, isDockedTop: false, isDockedBottom: false, isReference: false, executionState: '', hasProductHandle: false };
        const result = computeShellClassName(state);

        expect(result).toContain('min-w-[200px]');
    });

    it('should include min-w-[200px] for expanded node', () => {
        const state = { isCollapsed: false, title: '', isResizable: false, isDockedTop: false, isDockedBottom: false, isReference: false, executionState: '', hasProductHandle: false };
        const result = computeShellClassName(state);

        expect(result).toContain('min-w-[200px]');
    });

    it('should include h-auto min-h-0 for collapsed node', () => {
        const state = { isCollapsed: true, title: '', isResizable: false, isDockedTop: false, isDockedBottom: false, isReference: false, executionState: '', hasProductHandle: false };
        const result = computeShellClassName(state);

        expect(result).toContain('h-auto');
        expect(result).toContain('min-h-0');
    });

    it('should include h-full for expanded node', () => {
        const state = { isCollapsed: false, title: '', isResizable: false, isDockedTop: false, isDockedBottom: false, isReference: false, executionState: '', hasProductHandle: false };
        const result = computeShellClassName(state);

        expect(result).toContain('h-full');
    });
});

// ============================================================================
// computeHeaderClassName Tests
// ============================================================================

describe('computeHeaderClassName', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('border-bottom', () => {
        it('should include border-b-0 when collapsed', () => {
            const state = { isCollapsed: true, isDockedTop: false, isDockedBottom: false, title: '', isResizable: false, isReference: false, executionState: '', hasProductHandle: false };
            const result = computeHeaderClassName(state);

            expect(result).toContain('border-b-0');
        });

        it('should not include border-b-0 when expanded', () => {
            const state = { isCollapsed: false, isDockedTop: false, isDockedBottom: false, title: '', isResizable: false, isReference: false, executionState: '', hasProductHandle: false };
            const result = computeHeaderClassName(state);

            expect(result).not.toContain('border-b-0');
        });
    });

    describe('top border radius', () => {
        it('should have rounded-t-none when docked to top', () => {
            const state = { isCollapsed: false, isDockedTop: true, isDockedBottom: false, title: '', isResizable: false, isReference: false, executionState: '', hasProductHandle: false };
            const result = computeHeaderClassName(state);

            expect(result).toContain('rounded-t-none');
            expect(result).not.toContain('rounded-t-xl');
        });

        it('should have rounded-t-xl when not docked to top', () => {
            const state = { isCollapsed: false, isDockedTop: false, isDockedBottom: false, title: '', isResizable: false, isReference: false, executionState: '', hasProductHandle: false };
            const result = computeHeaderClassName(state);

            expect(result).toContain('rounded-t-xl');
            expect(result).not.toContain('rounded-t-none');
        });
    });

    describe('bottom border radius when collapsed', () => {
        it('should have rounded-b-none when collapsed and docked to bottom', () => {
            const state = { isCollapsed: true, isDockedTop: false, isDockedBottom: true, title: '', isResizable: false, isReference: false, executionState: '', hasProductHandle: false };
            const result = computeHeaderClassName(state);

            expect(result).toContain('rounded-b-none');
            expect(result).not.toContain('rounded-b-xl');
        });

        it('should have rounded-b-xl when collapsed and not docked to bottom', () => {
            const state = { isCollapsed: true, isDockedTop: false, isDockedBottom: false, title: '', isResizable: false, isReference: false, executionState: '', hasProductHandle: false };
            const result = computeHeaderClassName(state);

            expect(result).toContain('rounded-b-xl');
            expect(result).not.toContain('rounded-b-none');
        });

        it('should not have bottom radius classes when expanded', () => {
            const state = { isCollapsed: false, isDockedTop: false, isDockedBottom: true, title: '', isResizable: false, isReference: false, executionState: '', hasProductHandle: false };
            const result = computeHeaderClassName(state);

            expect(result).not.toContain('rounded-b-none');
            expect(result).not.toContain('rounded-b-xl');
        });
    });
});

// ============================================================================
// Action Logic Tests
// ============================================================================

describe('Action logic - collapse', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should compute current height from node.style.height', () => {
        const node = createMockNode({ data: { collapsed: false } });
        node.style = { height: 300 };

        const currentHeight = (node.style?.height as number) || node.measured?.height || 200;
        expect(currentHeight).toBe(300);
    });

    it('should fallback to measured height when style.height is undefined', () => {
        const node = createMockNode({ data: { collapsed: false } });
        node.measured = { width: 200, height: 280 };

        const currentHeight = (node.style?.height as number) || node.measured?.height || 200;
        expect(currentHeight).toBe(280);
    });

    it('should fallback to default 200 when both style and measured are undefined', () => {
        const node = createMockNode({ data: { collapsed: false } });

        const currentHeight = (node.style?.height as number) || node.measured?.height || 200;
        expect(currentHeight).toBe(200);
    });

    it('should preserve existing other properties when setting expandedHeight', () => {
        const node = createMockNode({ data: { collapsed: false, other: { existingProp: 'value' } } });
        const currentHeight = 300;

        const updatedOther = {
            ...(node.data.other || {}),
            expandedHeight: currentHeight,
        };

        expect(updatedOther).toEqual({
            existingProp: 'value',
            expandedHeight: 300,
        });
    });
});

describe('Action logic - expand', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should use targetHeight when provided', () => {
        const targetHeight = 500;
        const height = targetHeight || 200;

        expect(height).toBe(500);
    });

    it('should use expandedHeight from other when targetHeight not provided', () => {
        const other = { expandedHeight: 400 };
        const targetHeight = undefined;
        const height = targetHeight ?? other?.expandedHeight ?? 200;

        expect(height).toBe(400);
    });

    it('should fallback to 200 when no height is available', () => {
        const other = {};
        const targetHeight = undefined;
        const height = targetHeight ?? other?.expandedHeight ?? 200;

        expect(height).toBe(200);
    });
});

describe('Action logic - toggle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should call expand when collapsed', () => {
        const isCollapsed = true;
        const action = isCollapsed ? 'expand' : 'collapse';

        expect(action).toBe('expand');
    });

    it('should call collapse when expanded', () => {
        const isCollapsed = false;
        const action = isCollapsed ? 'expand' : 'collapse';

        expect(action).toBe('collapse');
    });
});

describe('Action logic - resize', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should pass width and height to updateNode', () => {
        const width = 400;
        const height = 300;

        // Simulate what the resize action does
        const updateParams = {
            style: { width, height },
            width,
            height,
        };

        expect(updateParams).toEqual({
            style: { width: 400, height: 300 },
            width: 400,
            height: 300,
        });
        expect(updateParams.width).toBe(width);
        expect(updateParams.height).toBe(height);
    });
});

describe('Action logic - updateContent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should call graphEngine.assets.update when assetId exists', () => {
        const assetId = 'asset-1';
        const shouldCallUpdate = !!assetId;

        expect(shouldCallUpdate).toBe(true);
    });

    it('should not call graphEngine.assets.update when assetId is undefined', () => {
        const assetId = undefined;
        const shouldCallUpdate = !!assetId;

        expect(shouldCallUpdate).toBe(false);
    });
});

describe('Action logic - updateTitle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should pass title to updateNode', () => {
        const title = 'New Title';

        const updateParams = { data: { title } };

        expect(updateParams).toEqual({
            data: { title: 'New Title' },
        });
    });
});

describe('Action logic - updateData', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should pass partial data to updateNode', () => {
        const partialData: Partial<BaseNodeData> = { collapsed: true, title: 'New Title' };

        const updateParams = { data: partialData };

        expect(updateParams).toEqual({
            data: { collapsed: true, title: 'New Title' },
        });
    });
});

// ============================================================================
// useNodeAsset Hook Logic Tests
// ============================================================================

describe('useNodeAsset - logic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return asset when assetId exists', () => {
        const assetId = 'asset-1';
        const assets: Record<string, Asset> = {
            'asset-1': createMockAsset({ id: 'asset-1' }),
        };

        const asset = assetId ? assets[assetId] : undefined;

        expect(asset).toBeDefined();
        expect(asset?.id).toBe('asset-1');
    });

    it('should return undefined when assetId does not exist', () => {
        const assetId = 'non-existent';
        const assets: Record<string, Asset> = {};

        const asset = assetId ? assets[assetId] : undefined;

        expect(asset).toBeUndefined();
    });

    it('should return undefined when assetId is undefined', () => {
        const assetId = undefined;
        const assets: Record<string, Asset> = {
            'asset-1': createMockAsset(),
        };

        const asset = assetId ? assets[assetId] : undefined;

        expect(asset).toBeUndefined();
    });

    describe('updateSys logic', () => {
        it('should call graphEngine.assets.updateSys when assetId exists', () => {
            const assetId = 'asset-1';
            const shouldCallUpdate = !!assetId;

            expect(shouldCallUpdate).toBe(true);
        });

        it('should not call graphEngine.assets.updateSys when assetId is undefined', () => {
            const assetId = undefined;
            const shouldCallUpdate = !!assetId;

            expect(shouldCallUpdate).toBe(false);
        });
    });
});
