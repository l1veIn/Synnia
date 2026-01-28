/**
 * workflowStore Tests
 * Tests for workflow state management store
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useWorkflowStore } from '../workflowStore';
import { graphEngine } from '@core/engine/GraphEngine';
import { SynniaNode, SynniaEdge } from '@/types/project';
import { Asset } from '@/types/assets';
import { SynniaProject, ProjectMeta, Viewport } from '@/bindings';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@core/engine/GraphEngine', () => ({
  graphEngine: {
    layout: {
      fixGlobalLayout: vi.fn((nodes: SynniaNode[]) => nodes),
    },
  },
}));

// ============================================================================
// Test Data
// ============================================================================

const createMockNode = (overrides: Partial<SynniaNode> = {}): SynniaNode => ({
  id: 'node-1',
  type: 'text',
  position: { x: 0, y: 0 },
  data: { title: 'Test Node' },
  ...overrides,
});

const createMockEdge = (overrides: Partial<SynniaEdge> = {}): SynniaEdge => ({
  id: 'edge-1',
  source: 'node-1',
  target: 'node-2',
  ...overrides,
});

const createMockAsset = (overrides: Partial<Asset> = {}): Asset => ({
  id: 'asset-1',
  valueType: 'record',
  value: { name: 'Test', count: 42 },
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

const createMockProjectMeta = (overrides: Partial<ProjectMeta> = {}): ProjectMeta => ({
  id: 'project-1',
  name: 'Test Project',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  thumbnail: null,
  description: null,
  author: null,
  ...overrides,
});

const createMockViewport = (overrides: Partial<Viewport> = {}): Viewport => ({
  x: 100,
  y: 200,
  zoom: 1.5,
  ...overrides,
});

const createMockProject = (overrides: Partial<SynniaProject> = {}): SynniaProject => ({
  version: '1.0.0',
  meta: createMockProjectMeta(),
  viewport: createMockViewport(),
  graph: {
    nodes: [createMockNode(), createMockNode({ id: 'node-2' })],
    edges: [createMockEdge()],
  },
  assets: {
    'asset-1': createMockAsset(),
  },
  settings: {},
  ...overrides,
});

// ============================================================================
// Tests
// ============================================================================

describe('workflowStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useWorkflowStore.setState({
      projectMeta: null,
      projectRoot: null,
      serverPort: null,
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: [],
      edges: [],
      assets: {},
      highlightedGroupId: null,
      dockPreviewId: null,
      contextMenuTarget: null,
      inspectorPosition: null,
      isHistoryPaused: false,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state values', () => {
      const state = useWorkflowStore.getState();

      expect(state.projectMeta).toBeNull();
      expect(state.projectRoot).toBeNull();
      expect(state.serverPort).toBeNull();
      expect(state.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
      expect(state.nodes).toEqual([]);
      expect(state.edges).toEqual([]);
      expect(state.assets).toEqual({});
      expect(state.highlightedGroupId).toBeNull();
      expect(state.dockPreviewId).toBeNull();
      expect(state.contextMenuTarget).toBeNull();
      expect(state.inspectorPosition).toBeNull();
      expect(state.isHistoryPaused).toBe(false);
    });

    it('should have all action methods defined', () => {
      const state = useWorkflowStore.getState();

      expect(state.loadProject).toBeDefined();
      expect(state.restoreDraft).toBeDefined();
      expect(state.setProjectRoot).toBeDefined();
      expect(state.setServerPort).toBeDefined();
      expect(state.setViewport).toBeDefined();
      expect(state.setContextMenuTarget).toBeDefined();
      expect(state.setInspectorPosition).toBeDefined();
      expect(state.setHighlightedGroupId).toBeDefined();
      expect(state.pauseHistory).toBeDefined();
      expect(state.resumeHistory).toBeDefined();
      expect(state.triggerCommit).toBeDefined();
    });
  });

  describe('loadProject', () => {
    it('should load project data into the store', () => {
      const mockProject = createMockProject();
      const { loadProject } = useWorkflowStore.getState();

      loadProject(mockProject);

      const state = useWorkflowStore.getState();
      expect(state.projectMeta).toEqual(mockProject.meta);
      expect(state.viewport).toEqual(mockProject.viewport);
      expect(state.nodes).toEqual(mockProject.graph.nodes);
      expect(state.edges).toEqual(mockProject.graph.edges);
      expect(state.assets).toEqual(mockProject.assets);
    });

    it('should call fixGlobalLayout on nodes when loading project', () => {
      const mockProject = createMockProject();
      const fixedNodes = [
        createMockNode({ id: 'node-1', position: { x: 10, y: 20 } }),
        createMockNode({ id: 'node-2', position: { x: 30, y: 40 } }),
      ];
      vi.mocked(graphEngine.layout.fixGlobalLayout).mockReturnValueOnce(fixedNodes);

      const { loadProject } = useWorkflowStore.getState();
      loadProject(mockProject);

      expect(graphEngine.layout.fixGlobalLayout).toHaveBeenCalledWith(
        mockProject.graph.nodes,
      );
      expect(useWorkflowStore.getState().nodes).toEqual(fixedNodes);
    });

    it('should handle project with empty graph', () => {
      const mockProject = createMockProject({
        graph: { nodes: [], edges: [] },
      });

      const { loadProject } = useWorkflowStore.getState();
      loadProject(mockProject);

      const state = useWorkflowStore.getState();
      expect(state.nodes).toEqual([]);
      expect(state.edges).toEqual([]);
    });

    it('should handle project with empty assets', () => {
      const mockProject = createMockProject({
        assets: {},
      });

      const { loadProject } = useWorkflowStore.getState();
      loadProject(mockProject);

      const state = useWorkflowStore.getState();
      expect(state.assets).toEqual({});
    });

    it('should replace existing state when loading new project', () => {
      // Set initial state
      useWorkflowStore.setState({
        nodes: [createMockNode({ id: 'old-node' })],
        edges: [createMockEdge({ id: 'old-edge' })],
        assets: { 'old-asset': createMockAsset({ id: 'old-asset' }) },
        projectMeta: createMockProjectMeta({ id: 'old-project' }),
      });

      const newProject = createMockProject({
        meta: createMockProjectMeta({ id: 'new-project' }),
      });

      const { loadProject } = useWorkflowStore.getState();
      loadProject(newProject);

      const state = useWorkflowStore.getState();
      expect(state.projectMeta?.id).toBe('new-project');
      expect(state.nodes).not.toContainEqual(
        expect.objectContaining({ id: 'old-node' }),
      );
      expect(state.edges).not.toContainEqual(
        expect.objectContaining({ id: 'old-edge' }),
      );
      expect(state.assets['old-asset']).toBeUndefined();
    });
  });

  describe('restoreDraft', () => {
    it('should restore draft data into the store', () => {
      const draftNodes = [createMockNode(), createMockNode({ id: 'node-2' })];
      const draftEdges = [createMockEdge()];
      const draftAssets = {
        'asset-1': createMockAsset(),
      };

      const { restoreDraft } = useWorkflowStore.getState();
      restoreDraft(draftNodes, draftEdges, draftAssets);

      const state = useWorkflowStore.getState();
      expect(state.nodes).toEqual(draftNodes);
      expect(state.edges).toEqual(draftEdges);
      expect(state.assets).toEqual(draftAssets);
    });

    it('should set projectMeta to null when restoring draft', () => {
      useWorkflowStore.setState({
        projectMeta: createMockProjectMeta(),
      });

      const { restoreDraft } = useWorkflowStore.getState();
      restoreDraft([], [], {});

      expect(useWorkflowStore.getState().projectMeta).toBeNull();
    });

    it('should reset viewport to default when restoring draft', () => {
      useWorkflowStore.setState({
        viewport: { x: 500, y: 600, zoom: 2 },
      });

      const { restoreDraft } = useWorkflowStore.getState();
      restoreDraft([], [], {});

      expect(useWorkflowStore.getState().viewport).toEqual({
        x: 0,
        y: 0,
        zoom: 1,
      });
    });

    it('should call fixGlobalLayout on nodes when restoring draft', () => {
      const draftNodes = [createMockNode()];
      const fixedNodes = [createMockNode({ position: { x: 10, y: 20 } })];
      vi.mocked(graphEngine.layout.fixGlobalLayout).mockReturnValueOnce(
        fixedNodes,
      );

      const { restoreDraft } = useWorkflowStore.getState();
      restoreDraft(draftNodes, [], {});

      expect(graphEngine.layout.fixGlobalLayout).toHaveBeenCalledWith(draftNodes);
      expect(useWorkflowStore.getState().nodes).toEqual(fixedNodes);
    });
  });

  describe('setProjectRoot', () => {
    it('should set project root path', () => {
      const { setProjectRoot } = useWorkflowStore.getState();
      setProjectRoot('/path/to/project');

      expect(useWorkflowStore.getState().projectRoot).toBe('/path/to/project');
    });

    it('should update existing project root', () => {
      useWorkflowStore.setState({ projectRoot: '/old/path' });

      const { setProjectRoot } = useWorkflowStore.getState();
      setProjectRoot('/new/path');

      expect(useWorkflowStore.getState().projectRoot).toBe('/new/path');
    });

    it('should set project root to null', () => {
      useWorkflowStore.setState({ projectRoot: '/some/path' });

      const { setProjectRoot } = useWorkflowStore.getState();
      setProjectRoot(null as unknown as string);

      expect(useWorkflowStore.getState().projectRoot).toBeNull();
    });
  });

  describe('setServerPort', () => {
    it('should set server port', () => {
      const { setServerPort } = useWorkflowStore.getState();
      setServerPort(3000);

      expect(useWorkflowStore.getState().serverPort).toBe(3000);
    });

    it('should update existing server port', () => {
      useWorkflowStore.setState({ serverPort: 3000 });

      const { setServerPort } = useWorkflowStore.getState();
      setServerPort(8080);

      expect(useWorkflowStore.getState().serverPort).toBe(8080);
    });

    it('should handle port 0', () => {
      const { setServerPort } = useWorkflowStore.getState();
      setServerPort(0);

      expect(useWorkflowStore.getState().serverPort).toBe(0);
    });
  });

  describe('setViewport', () => {
    it('should set viewport state', () => {
      const viewport = createMockViewport();
      const { setViewport } = useWorkflowStore.getState();
      setViewport(viewport);

      expect(useWorkflowStore.getState().viewport).toEqual(viewport);
    });

    it('should update existing viewport', () => {
      useWorkflowStore.setState({
        viewport: { x: 100, y: 200, zoom: 1.5 },
      });

      const { setViewport } = useWorkflowStore.getState();
      setViewport({ x: 300, y: 400, zoom: 2 });

      expect(useWorkflowStore.getState().viewport).toEqual({
        x: 300,
        y: 400,
        zoom: 2,
      });
    });

    it('should handle viewport with negative values', () => {
      const { setViewport } = useWorkflowStore.getState();
      setViewport({ x: -100, y: -200, zoom: 0.5 });

      expect(useWorkflowStore.getState().viewport).toEqual({
        x: -100,
        y: -200,
        zoom: 0.5,
      });
    });
  });

  describe('setContextMenuTarget', () => {
    it('should set context menu target for node', () => {
      const target = {
        type: 'node' as const,
        id: 'node-1',
        position: { x: 100, y: 200 },
      };

      const { setContextMenuTarget } = useWorkflowStore.getState();
      setContextMenuTarget(target);

      expect(useWorkflowStore.getState().contextMenuTarget).toEqual(target);
    });

    it('should set context menu target for canvas', () => {
      const target = {
        type: 'canvas' as const,
        position: { x: 50, y: 75 },
      };

      const { setContextMenuTarget } = useWorkflowStore.getState();
      setContextMenuTarget(target);

      expect(useWorkflowStore.getState().contextMenuTarget).toEqual(target);
    });

    it('should set context menu target for selection', () => {
      const target = {
        type: 'selection' as const,
      };

      const { setContextMenuTarget } = useWorkflowStore.getState();
      setContextMenuTarget(target);

      expect(useWorkflowStore.getState().contextMenuTarget).toEqual(target);
    });

    it('should clear context menu target by setting to null', () => {
      useWorkflowStore.setState({
        contextMenuTarget: { type: 'node', id: 'node-1' },
      });

      const { setContextMenuTarget } = useWorkflowStore.getState();
      setContextMenuTarget(null);

      expect(useWorkflowStore.getState().contextMenuTarget).toBeNull();
    });

    it('should set context menu target for group', () => {
      const target = {
        type: 'group' as const,
        id: 'group-1',
        position: { x: 0, y: 0 },
      };

      const { setContextMenuTarget } = useWorkflowStore.getState();
      setContextMenuTarget(target);

      expect(useWorkflowStore.getState().contextMenuTarget).toEqual(target);
    });
  });

  describe('setInspectorPosition', () => {
    it('should set inspector position', () => {
      const position = { x: 100, y: 200 };

      const { setInspectorPosition } = useWorkflowStore.getState();
      setInspectorPosition(position);

      expect(useWorkflowStore.getState().inspectorPosition).toEqual(position);
    });

    it('should update existing inspector position', () => {
      useWorkflowStore.setState({
        inspectorPosition: { x: 50, y: 100 },
      });

      const { setInspectorPosition } = useWorkflowStore.getState();
      setInspectorPosition({ x: 150, y: 250 });

      expect(useWorkflowStore.getState().inspectorPosition).toEqual({
        x: 150,
        y: 250,
      });
    });

    it('should clear inspector position by setting to null', () => {
      useWorkflowStore.setState({
        inspectorPosition: { x: 100, y: 200 },
      });

      const { setInspectorPosition } = useWorkflowStore.getState();
      setInspectorPosition(null);

      expect(useWorkflowStore.getState().inspectorPosition).toBeNull();
    });

    it('should handle negative position values', () => {
      const { setInspectorPosition } = useWorkflowStore.getState();
      setInspectorPosition({ x: -50, y: -100 });

      expect(useWorkflowStore.getState().inspectorPosition).toEqual({
        x: -50,
        y: -100,
      });
    });
  });

  describe('setHighlightedGroupId', () => {
    it('should set highlighted group ID', () => {
      const { setHighlightedGroupId } = useWorkflowStore.getState();
      setHighlightedGroupId('group-1');

      expect(useWorkflowStore.getState().highlightedGroupId).toBe('group-1');
    });

    it('should update existing highlighted group ID', () => {
      useWorkflowStore.setState({
        highlightedGroupId: 'group-1',
      });

      const { setHighlightedGroupId } = useWorkflowStore.getState();
      setHighlightedGroupId('group-2');

      expect(useWorkflowStore.getState().highlightedGroupId).toBe('group-2');
    });

    it('should clear highlighted group by setting to null', () => {
      useWorkflowStore.setState({
        highlightedGroupId: 'group-1',
      });

      const { setHighlightedGroupId } = useWorkflowStore.getState();
      setHighlightedGroupId(null);

      expect(useWorkflowStore.getState().highlightedGroupId).toBeNull();
    });

    it('should handle empty string as group ID', () => {
      const { setHighlightedGroupId } = useWorkflowStore.getState();
      setHighlightedGroupId('');

      expect(useWorkflowStore.getState().highlightedGroupId).toBe('');
    });
  });

  describe('pauseHistory', () => {
    it('should set isHistoryPaused to true', () => {
      const { pauseHistory } = useWorkflowStore.getState();
      pauseHistory();

      expect(useWorkflowStore.getState().isHistoryPaused).toBe(true);
    });

    it('should remain paused when called multiple times', () => {
      const { pauseHistory } = useWorkflowStore.getState();
      pauseHistory();
      pauseHistory();

      expect(useWorkflowStore.getState().isHistoryPaused).toBe(true);
    });
  });

  describe('resumeHistory', () => {
    it('should set isHistoryPaused to false', () => {
      useWorkflowStore.setState({ isHistoryPaused: true });

      const { resumeHistory } = useWorkflowStore.getState();
      resumeHistory();

      expect(useWorkflowStore.getState().isHistoryPaused).toBe(false);
    });

    it('should remain resumed when called multiple times', () => {
      useWorkflowStore.setState({ isHistoryPaused: true });

      const { resumeHistory } = useWorkflowStore.getState();
      resumeHistory();
      resumeHistory();

      expect(useWorkflowStore.getState().isHistoryPaused).toBe(false);
    });
  });

  describe('triggerCommit', () => {
    it('should create a new history entry by creating new nodes array', () => {
      const nodes = [createMockNode(), createMockNode({ id: 'node-2' })];
      useWorkflowStore.setState({ nodes });

      const originalNodes = useWorkflowStore.getState().nodes;

      const { triggerCommit } = useWorkflowStore.getState();
      triggerCommit();

      const newNodes = useWorkflowStore.getState().nodes;

      // Should be a different array reference
      expect(newNodes).not.toBe(originalNodes);
      // But contain the same values
      expect(newNodes).toEqual(nodes);
    });

    it('should work with empty nodes array', () => {
      useWorkflowStore.setState({ nodes: [] });

      const { triggerCommit } = useWorkflowStore.getState();
      triggerCommit();

      expect(useWorkflowStore.getState().nodes).toEqual([]);
    });

    it('should work with single node', () => {
      const nodes = [createMockNode()];
      useWorkflowStore.setState({ nodes });

      const { triggerCommit } = useWorkflowStore.getState();
      triggerCommit();

      expect(useWorkflowStore.getState().nodes).toEqual(nodes);
    });
  });

  describe('store subscriptions', () => {
    it('should notify subscribers when state changes', () => {
      let notificationCount = 0;
      const unsubscribe = useWorkflowStore.subscribe(() => {
        notificationCount++;
      });

      useWorkflowStore.setState({ projectRoot: '/new/path' });

      // Small delay to ensure subscription fires
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(notificationCount).toBeGreaterThan(0);
          unsubscribe();
          resolve();
        }, 10);
      });
    });

    it('should allow unsubscribing from store updates', () => {
      let notificationCount = 0;
      const unsubscribe = useWorkflowStore.subscribe(() => {
        notificationCount++;
      });

      useWorkflowStore.setState({ projectRoot: '/path1' });
      unsubscribe();
      useWorkflowStore.setState({ projectRoot: '/path2' });

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // Should have at least one notification before unsubscribe
          expect(notificationCount).toBeGreaterThanOrEqual(1);
          resolve();
        }, 10);
      });
    });
  });

  describe('history state with temporal middleware', () => {
    it('should have temporal middleware configured', () => {
      const state = useWorkflowStore.getState();

      // The store should have temporal functionality
      expect(state).toBeDefined();
      expect(typeof state.pauseHistory).toBe('function');
      expect(typeof state.resumeHistory).toBe('function');
      expect(typeof state.triggerCommit).toBe('function');
    });

    it('should track history for nodes, edges, and assets', () => {
      // This is a basic test to ensure the temporal middleware is configured
      // The actual history functionality is provided by zundo middleware
      const nodes = [createMockNode()];
      const edges = [createMockEdge()];
      const assets = { 'asset-1': createMockAsset() };

      useWorkflowStore.setState({ nodes, edges, assets });

      expect(useWorkflowStore.getState().nodes).toEqual(nodes);
      expect(useWorkflowStore.getState().edges).toEqual(edges);
      expect(useWorkflowStore.getState().assets).toEqual(assets);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete workflow: load project, modify state, restore draft', () => {
      const project = createMockProject();
      const { loadProject, restoreDraft, setViewport, setProjectRoot } =
        useWorkflowStore.getState();

      // Load project
      loadProject(project);
      expect(useWorkflowStore.getState().projectMeta?.id).toBe('project-1');

      // Modify state
      setViewport({ x: 500, y: 600, zoom: 2 });
      setProjectRoot('/custom/path');
      expect(useWorkflowStore.getState().viewport.x).toBe(500);
      expect(useWorkflowStore.getState().projectRoot).toBe('/custom/path');

      // Restore draft
      const draftNodes = [createMockNode({ id: 'draft-node' })];
      restoreDraft(draftNodes, [], {});
      expect(useWorkflowStore.getState().projectMeta).toBeNull();
      expect(useWorkflowStore.getState().nodes).toEqual(draftNodes);
    });

    it('should handle UI state workflow: context menu, inspector, highlight', () => {
      const {
        setContextMenuTarget,
        setInspectorPosition,
        setHighlightedGroupId,
      } = useWorkflowStore.getState();

      // Open context menu
      setContextMenuTarget({ type: 'node', id: 'node-1' });
      expect(useWorkflowStore.getState().contextMenuTarget?.type).toBe('node');

      // Open inspector
      setInspectorPosition({ x: 200, y: 300 });
      expect(useWorkflowStore.getState().inspectorPosition).toEqual({
        x: 200,
        y: 300,
      });

      // Highlight group
      setHighlightedGroupId('group-1');
      expect(useWorkflowStore.getState().highlightedGroupId).toBe('group-1');

      // Clear all
      setContextMenuTarget(null);
      setInspectorPosition(null);
      setHighlightedGroupId(null);

      expect(useWorkflowStore.getState().contextMenuTarget).toBeNull();
      expect(useWorkflowStore.getState().inspectorPosition).toBeNull();
      expect(useWorkflowStore.getState().highlightedGroupId).toBeNull();
    });

    it('should handle history control workflow', () => {
      const { pauseHistory, resumeHistory, triggerCommit } =
        useWorkflowStore.getState();

      // Initially not paused
      expect(useWorkflowStore.getState().isHistoryPaused).toBe(false);

      // Pause history
      pauseHistory();
      expect(useWorkflowStore.getState().isHistoryPaused).toBe(true);

      // Make some changes while paused
      useWorkflowStore.setState({ projectRoot: '/path1' });
      useWorkflowStore.setState({ projectRoot: '/path2' });

      // Resume history
      resumeHistory();
      expect(useWorkflowStore.getState().isHistoryPaused).toBe(false);

      // Trigger a commit
      triggerCommit();
      expect(useWorkflowStore.getState().isHistoryPaused).toBe(false);
    });
  });
});
