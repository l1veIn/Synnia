import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { temporal } from 'zundo';
import { SynniaNode, SynniaEdge } from '@/types/project';
import { Asset } from '@/types/assets';
import { SynniaProject, ProjectMeta, Viewport } from '@/bindings/synnia';
import { graphEngine } from '@/lib/engine/GraphEngine';

let isHistoryPaused = false;

/**
 * WorkflowState - Pure State Container
 * 
 * This store holds ONLY data. All business logic lives in GraphEngine.
 * Components read from here, but write through graphEngine.
 */
export interface WorkflowState {
  // Project
  projectMeta: ProjectMeta | null;
  projectRoot: string | null;
  serverPort: number | null;
  viewport: Viewport;

  // Graph Data
  nodes: SynniaNode[];
  edges: SynniaEdge[];
  assets: Record<string, Asset>;

  // UI State
  highlightedGroupId: string | null;
  contextMenuTarget: {
    type: 'node' | 'group' | 'canvas' | 'selection';
    id?: string;
    position?: { x: number; y: number };
  } | null;
  inspectorPosition: { x: number; y: number } | null;
}

/**
 * WorkflowActions - Minimal setters only
 * 
 * Only actions that MUST be on the store (project loading, UI state).
 * All graph operations go through graphEngine directly.
 */
export interface WorkflowActions {
  // Project Lifecycle
  loadProject: (project: SynniaProject) => void;
  restoreDraft: (nodes: SynniaNode[], edges: SynniaEdge[], assets: Record<string, Asset>) => void;

  // Pure Setters (for external updates)
  setProjectRoot: (path: string) => void;
  setServerPort: (port: number) => void;
  setViewport: (viewport: Viewport) => void;

  // UI State
  setContextMenuTarget: (target: WorkflowState['contextMenuTarget']) => void;
  setInspectorPosition: (pos: { x: number; y: number } | null) => void;
  setHighlightedGroupId: (id: string | null) => void;

  // History Control
  pauseHistory: () => void;
  resumeHistory: () => void;
  triggerCommit: () => void;
}

export const useWorkflowStore = create<WorkflowState & WorkflowActions>()(
  subscribeWithSelector(
    temporal(
      (set) => ({
        // Initial State
        projectMeta: null,
        projectRoot: null,
        serverPort: null,
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [],
        edges: [],
        assets: {},
        highlightedGroupId: null,
        contextMenuTarget: null,
        inspectorPosition: null,

        // Project Lifecycle
        loadProject: (project: SynniaProject) => {
          let loadedNodes = project.graph.nodes as unknown as SynniaNode[];
          loadedNodes = graphEngine.layout.fixGlobalLayout(loadedNodes);

          set({
            nodes: loadedNodes,
            edges: project.graph.edges as unknown as SynniaEdge[],
            assets: project.assets,
            projectMeta: project.meta,
            viewport: project.viewport,
          });
        },

        restoreDraft: (nodes, edges, assets) => {
          const fixedNodes = graphEngine.layout.fixGlobalLayout(nodes);
          set({
            nodes: fixedNodes,
            edges,
            assets,
            projectMeta: null,
            viewport: { x: 0, y: 0, zoom: 1 }
          });
        },

        // Pure Setters
        setProjectRoot: (path) => set({ projectRoot: path }),
        setServerPort: (port) => set({ serverPort: port }),
        setViewport: (viewport) => set({ viewport }),

        // UI State
        setContextMenuTarget: (target) => set({ contextMenuTarget: target }),
        setInspectorPosition: (pos) => set({ inspectorPosition: pos }),
        setHighlightedGroupId: (id) => set({ highlightedGroupId: id }),

        // History Control
        pauseHistory: () => { isHistoryPaused = true; },
        resumeHistory: () => { isHistoryPaused = false; },
        triggerCommit: () => set((state) => ({ nodes: [...state.nodes] })),
      }),
      {
        partialize: (state) => ({
          nodes: state.nodes,
          edges: state.edges,
          assets: state.assets,
        }),
        limit: 100,
        equality: (past, current) => {
          if (isHistoryPaused) return true;
          return JSON.stringify(past) === JSON.stringify(current);
        }
      }
    )
  )
);
