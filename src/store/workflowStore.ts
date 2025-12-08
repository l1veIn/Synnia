import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { temporal } from 'zundo';
import { graphEngine } from '@/lib/engine/GraphEngine';
import {
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
  XYPosition,
  OnNodeDrag,
} from '@xyflow/react';
import { SynniaNode, NodeType, SynniaEdge } from '@/types/project';
import { Asset, AssetType } from '@/types/assets';
import { SynniaProject, ProjectMeta, Viewport } from '@/bindings/synnia';

let isHistoryPaused = false;


export interface WorkflowState {
  projectMeta: ProjectMeta | null;
  projectRoot: string | null;
  serverPort: number | null;
  viewport: Viewport;
  nodes: SynniaNode[];
  edges: SynniaEdge[];
  assets: Record<string, Asset>;
  highlightedGroupId: string | null;
  contextMenuTarget: {
    type: 'node' | 'group' | 'canvas' | 'selection';
    id?: string;
    position?: { x: number; y: number };
  } | null;
}

export interface WorkflowActions {
  loadProject: (project: SynniaProject) => void;
  restoreDraft: (nodes: SynniaNode[], edges: SynniaEdge[], assets: Record<string, Asset>) => void;
  onNodesChange: OnNodesChange<SynniaNode>;
  onEdgesChange: OnEdgesChange<SynniaEdge>;

  onConnect: OnConnect;
  onNodeDragStop: OnNodeDrag;
  onNodeDragStart: OnNodeDrag;
  onNodeDrag: OnNodeDrag;

  // Asset Management
  createAsset: (type: AssetType, content: any, metadata?: Partial<Asset['metadata']>) => string;
  updateAsset: (id: string, content: any) => void;
  updateAssetMetadata: (id: string, metadata: Partial<Asset['metadata']>) => void;
  deleteAsset: (id: string) => void;
  getAsset: (id: string) => Asset | undefined;

  addNode: (type: NodeType, position: XYPosition, options?: { assetType?: AssetType, content?: any, assetId?: string, assetName?: string, metadata?: any, style?: any }) => string;
  removeNode: (id: string) => void;
  updateNode: (id: string, updates: Partial<SynniaNode>) => void;
  updateNodeData: (id: string, data: Partial<SynniaNode['data']>) => void;
  setProjectRoot: (path: string) => void;
  setServerPort: (port: number) => void;

  setWorkflow: (nodes: SynniaNode[], edges: SynniaEdge[]) => void;
  triggerCommit: () => void;
  pasteNodes: (copiedNodes: SynniaNode[]) => void;
  pasteNodesAsShortcut: (copiedNodes: SynniaNode[]) => void;

  pauseHistory: () => void;
  resumeHistory: () => void;
  setContextMenuTarget: (target: WorkflowState['contextMenuTarget']) => void;
  duplicateNode: (node: SynniaNode, position?: XYPosition) => void;
  handleAltDragStart: (nodeId: string) => string;
  handleDragStopOpacity: (nodeId: string) => void;
  detachNode: (nodeId: string) => void;
  createShortcut: (nodeId: string) => void;
  createRackFromSelection: () => void;
}

export const useWorkflowStore = create<WorkflowState & WorkflowActions>()(
  subscribeWithSelector(
    temporal(
      (set, get) => ({
        projectMeta: null,
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [],
        edges: [],
        assets: {},
        projectRoot: null,
        serverPort: null,
        highlightedGroupId: null,
        contextMenuTarget: null,

        loadProject: (project: SynniaProject) => {
          let loadedNodes = project.graph.nodes as unknown as SynniaNode[];
          // Ensure Rack Layout is consistent (handles, dimensions)
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

        pauseHistory: () => { isHistoryPaused = true; },
        resumeHistory: () => { isHistoryPaused = false; },
        setContextMenuTarget: (target) => set({ contextMenuTarget: target }),

        createAsset: (type, content, metadata) => graphEngine.assets.create(type, content, metadata),

        updateAsset: (id, content) => graphEngine.assets.update(id, content),

        updateAssetMetadata: (id, metaUpdates) => graphEngine.assets.updateMetadata(id, metaUpdates),

        deleteAsset: (id) => graphEngine.assets.delete(id),

        getAsset: (id) => graphEngine.assets.get(id),


        detachNode: (nodeId) => graphEngine.mutator.detachNode(nodeId),

        createShortcut: (nodeId: string) => graphEngine.mutator.createShortcut(nodeId),

        createRackFromSelection: () => graphEngine.mutator.createRackFromSelection(),

        duplicateNode: (node, pos) => graphEngine.mutator.duplicateNode(node, pos),

        handleAltDragStart: (nodeId: string) => graphEngine.interaction.handleAltDragStart(nodeId),

        handleDragStopOpacity: (nodeId: string) => graphEngine.interaction.handleDragStopOpacity(nodeId),

        onNodesChange: (changes) => graphEngine.interaction.onNodesChange(changes),
        onEdgesChange: (changes) => graphEngine.interaction.onEdgesChange(changes),
        onConnect: (conn) => graphEngine.interaction.onConnect(conn),
        onNodeDrag: (e, node, nodes) => graphEngine.interaction.onNodeDrag(e, node, nodes),
        onNodeDragStop: (e, node, nodes) => graphEngine.interaction.onNodeDragStop(e, node, nodes),

        onNodeDragStart: (_event, node) => {
          // Placeholder
        },


        triggerCommit: () => {
          set(state => ({ nodes: [...state.nodes] }));
        },

        addNode: (type, position, options) => graphEngine.mutator.addNode(type, position, options),

        pasteNodes: (copiedNodes) => graphEngine.mutator.pasteNodes(copiedNodes),

        pasteNodesAsShortcut: (copiedNodes: SynniaNode[]) => {
          // TODO: Implement shortcut pasting logic
          console.warn("pasteNodesAsShortcut not implemented");
        },

        removeNode: (id) => graphEngine.mutator.removeNode(id),

        updateNode: (id: string, updates: Partial<SynniaNode>) => graphEngine.updateNode(id, updates),

        updateNodeData: (id: string, data: Partial<SynniaNode['data']>) => graphEngine.updateNode(id, { data }),

        setProjectRoot: (path: string) => set({ projectRoot: path }),
        setServerPort: (port: number) => set({ serverPort: port }),

        setWorkflow: (nodes, edges) => set({ nodes, edges }),
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
