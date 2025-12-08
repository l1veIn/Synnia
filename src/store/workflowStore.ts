import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { temporal } from 'zundo';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Connection,
  EdgeChange,
  NodeChange,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
  XYPosition,
  OnNodeDrag,
} from '@xyflow/react';
import { SynniaNode, NodeType, SynniaEdge } from '@/types/project';
import { Asset, AssetType } from '@/types/assets';
import { nodesConfig } from '@/components/workflow/nodes';
import { v4 as uuidv4 } from 'uuid';
import { 
    isNodeInsideGroup, 
    sortNodesTopologically, 
    getDescendants,
    sanitizeNodeForClipboard
} from '@/lib/graphUtils';
import {
    applyRackCollapse,
    applyRackExpand,
    fixRackLayout,
    applyGroupAutoLayout
} from '@/lib/rackLayout';
import { getContainerStrategy } from '@/lib/strategies/registry';
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
                loadedNodes = fixRackLayout(loadedNodes);
                
                set({
                    nodes: loadedNodes,
                    edges: project.graph.edges as unknown as SynniaEdge[],
                    assets: project.assets,
                    projectMeta: project.meta,
                    viewport: project.viewport,
                });
            },

            restoreDraft: (nodes, edges, assets) => {
                const fixedNodes = fixRackLayout(nodes);
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
            
            createAsset: (type, content, metadata = {}) => {
                const id = uuidv4();
                const now = Date.now();
                const newAsset: Asset = {
                    id,
                    type,
                    content,
                    metadata: {
                        createdAt: now,
                        updatedAt: now,
                        source: 'user',
                        extra: {},
                        ...metadata,
                        name: metadata.name || 'New Asset'
                    }
                };
                set(state => ({ assets: { ...state.assets, [id]: newAsset } }));
                return id;
            },
    
            updateAsset: (id, content) => {
                 set(state => {
                     const asset = state.assets[id];
                     if (!asset) return state;
                     return {
                         assets: {
                             ...state.assets,
                             [id]: {
                                 ...asset,
                                 content,
                                 metadata: { ...asset.metadata, updatedAt: Date.now() }
                             }
                         }
                     };
                 });
            },

            updateAssetMetadata: (id, metaUpdates) => {
                 set(state => {
                     const asset = state.assets[id];
                     if (!asset) return state;
                     return {
                         assets: {
                             ...state.assets,
                             [id]: {
                                 ...asset,
                                 metadata: { ...asset.metadata, ...metaUpdates, updatedAt: Date.now() }
                             }
                         }
                     };
                 });
            },
            
            deleteAsset: (id) => {
                 set(state => {
                     const { [id]: deleted, ...remainingAssets } = state.assets;
                     return { assets: remainingAssets };
                 });
            },
            
            getAsset: (id) => get().assets[id],
            
                
        detachNode: (nodeId) => graphEngine.mutator.detachNode(nodeId),
        
        createShortcut: (nodeId: string) => {
           const { nodes } = get();
           const node = nodes.find(n => n.id === nodeId);
           if (!node || node.type !== NodeType.ASSET) return;
           
           const newId = uuidv4();
           const sanitizedNode = sanitizeNodeForClipboard(node);
           
           const newNode: SynniaNode = {
               ...sanitizedNode,
               id: newId,
               position: { x: node.position.x + 20, y: node.position.y + 20 },
               selected: true,
               parentId: node.parentId,
               extent: node.extent,
               data: {
                   ...sanitizedNode.data,
                   isReference: true,
                   // assetId matches original
               }
           };
           
           const deselectedNodes = nodes.map(n => ({ ...n, selected: false }));
           const finalNodes = sortNodesTopologically([...deselectedNodes, newNode]);
           set({ nodes: finalNodes });
        },

        createRackFromSelection: () => graphEngine.mutator.createRackFromSelection(),

        duplicateNode: (node, pos) => graphEngine.mutator.duplicateNode(node, pos),

        handleAltDragStart: (nodeId: string) => graphEngine.interaction.handleAltDragStart(nodeId),
        
import { graphEngine } from '@/lib/engine/GraphEngine';

// ... (existing imports)

// ...

        handleDragStopOpacity: (nodeId: string) => graphEngine.interaction.handleDragStopOpacity(nodeId),

        onNodesChange: (changes) => graphEngine.interaction.onNodesChange(changes),
        onEdgesChange: (changes) => graphEngine.interaction.onEdgesChange(changes),
        onConnect: (conn) => graphEngine.interaction.onConnect(conn),
        onNodeDrag: (e, node) => graphEngine.interaction.onNodeDrag(e, node),
        onNodeDragStop: (e, node) => graphEngine.interaction.onNodeDragStop(e, node),

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

        updateNode: (id: string, updates: Partial<SynniaNode>) => {
          set({
            nodes: get().nodes.map((node) => {
              if (node.id === id) {
                return { ...node, ...updates };
              }
              return node;
            }),
          });
        },

        updateNodeData: (id: string, data: Partial<SynniaNode['data']>) => {
          set({
            nodes: get().nodes.map((node) => {
              if (node.id === id) {
                return {
                  ...node,
                  data: { ...node.data, ...data },
                };
              }
              return node;
            }),
          });
        },

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
