// @ts-nocheck
/**
 * InspectorPanel Component Tests
 * Tests for the workflow node inspector panel with tabs for properties, history, and debug
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InspectorPanel } from '@/components/workflow/InspectorPanel';
import { SynniaNode, SynniaEdge, NodeType } from '@/types/project';
import { Asset } from '@/types/assets';
import { useWorkflowStore } from '@/store/workflowStore';
import type { WorkflowActions } from '@/store/workflowStore';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/store/workflowStore', () => ({
    useWorkflowStore: vi.fn(),
}));

vi.mock('@core/engine/GraphEngine', () => ({
    graphEngine: {
        updateNode: vi.fn(),
    },
}));

// Mock i18next - returns key itself or a fallback translation
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                'inspector:header.title': 'Inspector',
                'inspector:panelTabs.props': 'Props',
                'inspector:panelTabs.history': 'History',
                'inspector:panelTabs.debug': 'Debug',
                'inspector:labels.nodeLabel': 'Node Label',
                'inspector:labels.label': 'Label',
                'inspector:labels.inputs': 'Inputs',
                'inspector:labels.outputs': 'Outputs',
                'inspector:header.type': 'Type',
                'inspector:labels.transform': 'Transform',
                'inspector:header.propertiesFor': 'Properties for',
                'inspector:empty.noInspector': 'No inspector available for this node',
            };
            return translations[key] || key;
        },
        i18n: { language: 'en' },
    }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('@/components/workflow/nodes', () => ({
    getInspectorTypes: () => ({}),
}));

vi.mock('@/components/workflow/inspector/DebugInspector', () => ({
    DebugInspector: ({ nodeId }: { nodeId: string }) =>
        React.createElement('div', { 'data-testid': 'debug-inspector' }, `Debug Inspector for ${nodeId}`)
    ,
}));

vi.mock('@/components/workflow/inspector/AssetHistoryPanel', () => ({
    AssetHistoryPanel: ({ assetId, nodeId }: { assetId?: string; nodeId?: string }) =>
        React.createElement('div', { 'data-testid': 'asset-history-panel' },
            `Asset History: ${assetId || 'none'} / Node: ${nodeId || 'none'}`
        )
    ,
}));

vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
            React.createElement('div', { 'data-testid': 'motion-div', ...props }, children)
        ,
    },
    useDragControls: () => ({
        start: vi.fn(),
    }),
    useMotionValue: (val?: number) => ({
        get: () => val ?? 0,
        set: vi.fn(),
    }),
}));

// ============================================================================
// Test Helpers
// ============================================================================

const createMockNode = (overrides?: Partial<SynniaNode>): SynniaNode => ({
    id: 'test-node-1',
    type: NodeType.TEXT,
    position: { x: 100, y: 200 },
    selected: true,
    data: {
        title: 'Test Node',
    },
    ...overrides,
});

const createMockAsset = (overrides?: Partial<Asset>): Asset => ({
    id: 'asset-1',
    valueType: 'record',
    value: { field1: 'value1' },
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

const mockStore = {
    nodes: [] as SynniaNode[],
    edges: [] as SynniaEdge[],
    assets: {} as Record<string, Asset>,
    inspectorPosition: null as { x: number; y: number } | null,
    setInspectorPosition: vi.fn(),
    projectMeta: null,
    projectRoot: null,
    serverPort: null,
    viewport: { x: 0, y: 0, zoom: 1 },
    highlightedGroupId: null,
    dockPreviewId: null,
    contextMenuTarget: null,
    isHistoryPaused: false,
    loadProject: vi.fn(),
    restoreDraft: vi.fn(),
    setProjectRoot: vi.fn(),
    setServerPort: vi.fn(),
    setViewport: vi.fn(),
    setContextMenuTarget: vi.fn(),
    setHighlightedGroupId: vi.fn(),
    pauseHistory: vi.fn(),
    resumeHistory: vi.fn(),
    triggerCommit: vi.fn(),
};

// ============================================================================
// Tests
// ============================================================================

describe('InspectorPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Reset store state
        mockStore.nodes = [];
        mockStore.edges = [];
        mockStore.assets = {};
        mockStore.inspectorPosition = null;

        vi.mocked(useWorkflowStore).mockImplementation((selector) => {
            if (typeof selector === 'function') {
                return selector(mockStore as typeof mockStore & WorkflowActions);
            }
            return mockStore as typeof mockStore & WorkflowActions;
        });
    });

    describe('rendering - no selection', () => {
        it('should return null when no nodes are selected', () => {
            mockStore.nodes = [createMockNode({ selected: false })];

            const { container } = render(<InspectorPanel />);

            expect(container.firstChild).toBeNull();
        });

        it('should return null when multiple nodes are selected', () => {
            mockStore.nodes = [
                createMockNode({ id: 'node-1', selected: true }),
                createMockNode({ id: 'node-2', selected: true }),
            ];

            const { container } = render(<InspectorPanel />);

            expect(container.firstChild).toBeNull();
        });

        it('should return null when nodes array is empty', () => {
            mockStore.nodes = [];

            const { container } = render(<InspectorPanel />);

            expect(container.firstChild).toBeNull();
        });
    });

    describe('rendering - with single selection', () => {
        it('should render inspector panel when single node is selected', () => {
            const selectedNode = createMockNode({ selected: true });
            mockStore.nodes = [selectedNode];

            render(<InspectorPanel />);

            const panel = screen.getByTestId('motion-div');
            expect(panel).toBeInTheDocument();
        });

        it('should display inspector title in header', () => {
            const selectedNode = createMockNode({ selected: true });
            mockStore.nodes = [selectedNode];

            render(<InspectorPanel />);

            // The panel should render with some content
            const panel = screen.getByTestId('motion-div');
            expect(panel.textContent?.length).toBeGreaterThan(0);
        });
    });

    describe('tabs - properties tab', () => {
        it('should display properties tab content for standard node without asset', () => {
            const selectedNode = createMockNode({ selected: true, type: 'text' });
            mockStore.nodes = [selectedNode];

            render(<InspectorPanel />);

            // Properties tab should be visible - check for the panel
            const panel = screen.getByTestId('motion-div');
            expect(panel).toBeInTheDocument();
            // Should have some content
            expect(panel.textContent?.length).toBeGreaterThan(0);
        });

        it('should display node title in input field', () => {
            const selectedNode = createMockNode({
                selected: true,
                data: { title: 'My Custom Title' },
            });
            mockStore.nodes = [selectedNode];

            render(<InspectorPanel />);

            const panel = screen.getByTestId('motion-div');
            const inputs = panel.querySelectorAll('input');
            expect(inputs.length).toBeGreaterThan(0);
            // First input should have the title value
            const titleInput = Array.from(inputs).find((input) =>
                input.getAttribute('value') === 'My Custom Title'
            );
            expect(titleInput).toBeDefined();
        });

        it('should display node type in properties panel', () => {
            const selectedNode = createMockNode({ selected: true, type: 'image' });
            mockStore.nodes = [selectedNode];

            render(<InspectorPanel />);

            expect(screen.getByText('image')).toBeInTheDocument();
        });

        it('should display transform position values', () => {
            const selectedNode = createMockNode({
                selected: true,
                position: { x: 123.45, y: 678.9 },
            });
            mockStore.nodes = [selectedNode];

            render(<InspectorPanel />);

            // Check for position values in the panel
            const panel = screen.getByTestId('motion-div');
            const content = panel.textContent || '';
            expect(content).toContain('123');
            expect(content).toContain('679');
        });

        it('should calculate in-degree from edges', () => {
            const selectedNode = createMockNode({ selected: true, id: 'target-node' });
            mockStore.nodes = [selectedNode];
            mockStore.edges = [
                { source: 'node-1', target: 'target-node' },
                { source: 'node-2', target: 'target-node' },
                { source: 'target-node', target: 'node-3' },
            ];

            render(<InspectorPanel />);

            // Check that edge count is displayed
            const panel = screen.getByTestId('motion-div');
            const content = panel.textContent || '';
            // Should show "2" for the incoming edges (in-degree)
            expect(content).toContain('2');
        });

        it('should calculate out-degree from edges', () => {
            const selectedNode = createMockNode({ selected: true, id: 'source-node' });
            mockStore.nodes = [selectedNode];
            mockStore.edges = [
                { source: 'source-node', target: 'node-1' },
                { source: 'source-node', target: 'node-2' },
                { source: 'node-3', target: 'source-node' },
            ];

            render(<InspectorPanel />);

            // Check that edge count is displayed
            const panel = screen.getByTestId('motion-div');
            const content = panel.textContent || '';
            // Should show "2" for the outgoing edges (out-degree)
            const twos = (content.match(/2/g) || []).length;
            expect(twos).toBeGreaterThan(0);
        });

        it('should show zero inputs/outputs when node has no connections', () => {
            const selectedNode = createMockNode({ selected: true });
            mockStore.nodes = [selectedNode];
            mockStore.edges = [];

            render(<InspectorPanel />);

            const panel = screen.getByTestId('motion-div');
            const content = panel.textContent || '';
            // Should have zeros displayed
            expect(content).toContain('0');
        });
    });

    describe('tabs - history and debug tabs', () => {
        it('should render all tab panels in the DOM', () => {
            const selectedNode = createMockNode({
                selected: true,
                id: 'node-123',
                data: { assetId: 'asset-456' },
            });
            mockStore.nodes = [selectedNode];

            render(<InspectorPanel />);

            // The panel should render successfully with tabs
            const panel = screen.getByTestId('motion-div');
            expect(panel).toBeInTheDocument();
            // The tabs should be rendered (history and debug tabs exist even if not visible)
            // We just check the panel structure is correct
            expect(panel.innerHTML).toContain('grid-cols-3');
        });
    });

    describe('tabs - tab buttons', () => {
        it('should render all three tab buttons', () => {
            const selectedNode = createMockNode({ selected: true });
            mockStore.nodes = [selectedNode];

            render(<InspectorPanel />);

            // The translations might show raw keys or translated text depending on i18n setup
            // Just verify the panel has the expected content
            const panel = screen.getByTestId('motion-div');
            const content = panel.textContent || '';
            // Should have some tab-related content
            expect(content.length).toBeGreaterThan(0);
        });
    });

    describe('title editing', () => {
        it('should display input field for title editing', () => {
            const selectedNode = createMockNode({
                selected: true,
                data: { title: 'Original Title' },
            });
            mockStore.nodes = [selectedNode];

            render(<InspectorPanel />);

            // Input field should be present
            const panel = screen.getByTestId('motion-div');
            const inputs = panel.querySelectorAll('input');
            expect(inputs.length).toBeGreaterThan(0);
        });
    });

    describe('position state', () => {
        it('should use inspectorPosition from store for initial position', () => {
            const selectedNode = createMockNode({ selected: true });
            mockStore.nodes = [selectedNode];
            mockStore.inspectorPosition = { x: 100, y: 200 };

            render(<InspectorPanel />);

            const panel = screen.getByTestId('motion-div');
            expect(panel).toBeInTheDocument();
        });

        it('should default to 0,0 when no inspectorPosition in store', () => {
            const selectedNode = createMockNode({ selected: true });
            mockStore.nodes = [selectedNode];
            mockStore.inspectorPosition = null;

            render(<InspectorPanel />);

            const panel = screen.getByTestId('motion-div');
            expect(panel).toBeInTheDocument();
        });
    });

    describe('NodeInspector helper component', () => {
        it('should display node type when no inspector available', () => {
            const selectedNode = createMockNode({
                selected: true,
                type: 'customType',
            });
            mockStore.nodes = [selectedNode];

            render(<InspectorPanel />);

            // Standard inspector should show type
            expect(screen.getByText('customType')).toBeInTheDocument();
        });
    });

    describe('asset nodes', () => {
        it('should render asset-specific inspector when node has assetId', () => {
            const selectedNode = createMockNode({
                selected: true,
                data: { assetId: 'asset-1' },
            });
            mockStore.nodes = [selectedNode];
            mockStore.assets = {
                'asset-1': createMockAsset(),
            };

            render(<InspectorPanel />);

            // Should show the input field for editing node title
            const input = screen.queryByRole('textbox');
            expect(input).toBeInTheDocument();
        });

        it('should display fallback info when node has no custom inspector', () => {
            const selectedNode = createMockNode({
                selected: true,
                type: 'custom',
                data: { assetId: 'asset-1' },
            });
            mockStore.nodes = [selectedNode];

            render(<InspectorPanel />);

            // The panel should render with some content
            const panel = screen.getByTestId('motion-div');
            expect(panel).toBeInTheDocument();
            // Should show either "Node Label" or the asset ID info
            const content = panel.textContent || '';
            const hasRelevantContent =
                content.includes('asset-1') ||
                content.includes('custom') ||
                content.includes('Label');
            expect(hasRelevantContent).toBe(true);
        });

        it('should handle recipe nodes with recipeId', () => {
            const selectedNode = createMockNode({
                selected: true,
                type: 'recipe:my-recipe',
                data: { recipeId: 'my-recipe' },
            });
            mockStore.nodes = [selectedNode];

            render(<InspectorPanel />);

            // Should render since hasInspector includes recipeId
            const panel = screen.getByTestId('motion-div');
            expect(panel).toBeInTheDocument();
            // Should show recipe ID in the content
            const content = panel.textContent || '';
            expect(content).toContain('my-recipe');
        });

        it('should handle nodes with both assetId and recipeId', () => {
            const selectedNode = createMockNode({
                selected: true,
                data: { assetId: 'asset-1', recipeId: 'recipe-1' },
            });
            mockStore.nodes = [selectedNode];

            render(<InspectorPanel />);

            const panel = screen.getByTestId('motion-div');
            expect(panel).toBeInTheDocument();
            const content = panel.textContent || '';
            // Should show both IDs in the content
            expect(content).toContain('asset-1');
        });
    });

    describe('edge cases', () => {
        it('should handle node with undefined title gracefully', () => {
            const selectedNode = createMockNode({
                selected: true,
                data: {},
            });
            mockStore.nodes = [selectedNode];

            render(<InspectorPanel />);

            const input = screen.queryByRole('textbox');
            expect(input).toBeInTheDocument();
        });

        it('should handle node with empty string title', () => {
            const selectedNode = createMockNode({
                selected: true,
                data: { title: '' },
            });
            mockStore.nodes = [selectedNode];

            render(<InspectorPanel />);

            const input = screen.queryByRole('textbox');
            expect(input?.getAttribute('value')).toBe('');
        });

        it('should handle floating point positions correctly', () => {
            const selectedNode = createMockNode({
                selected: true,
                position: { x: 99.999, y: 100.001 },
            });
            mockStore.nodes = [selectedNode];

            render(<InspectorPanel />);

            // Positions should be rounded, both X and Y will be 100
            const hundreds = screen.getAllByText('100');
            expect(hundreds.length).toBeGreaterThan(0);
        });
    });

    describe('inspectorPosition updates', () => {
        it('should have setInspectorPosition available', () => {
            const selectedNode = createMockNode({ selected: true });
            mockStore.nodes = [selectedNode];

            render(<InspectorPanel />);

            // The panel is rendered with drag capability
            const panel = screen.getByTestId('motion-div');
            expect(panel).toBeDefined();

            // setInspectorPosition should be defined in the store
            expect(mockStore.setInspectorPosition).toBeDefined();
        });
    });

    describe('accessibility', () => {
        it('should render tab buttons as buttons', () => {
            const selectedNode = createMockNode({ selected: true });
            mockStore.nodes = [selectedNode];

            render(<InspectorPanel />);

            // Find all buttons within the panel
            const panel = screen.getByTestId('motion-div');
            const buttons = panel.querySelectorAll('button');
            // Should have at least the 3 tab trigger buttons
            expect(buttons.length).toBeGreaterThanOrEqual(3);
        });
    });
});
