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
import { nodesConfig } from '@/components/workflow/nodes/registry';
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
  toggleNodeCollapse: (nodeId: string) => void;
  toggleGroupCollapse: (groupId: string) => void;
  autoLayoutGroup: (groupId: string) => void;
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
            
            autoLayoutGroup: (groupId: string) => {                    const { nodes } = get();
                    const group = nodes.find(n => n.id === groupId);
                    if (!group) return;
                    
                    const updatedNodes = applyGroupAutoLayout(nodes, group);
                    set({ nodes: updatedNodes });
                },
                
                detachNode: (nodeId: string) => {
                    const { nodes } = get();
                    const node = nodes.find(n => n.id === nodeId);
                    if (!node || !node.parentId) return;
        
                    const parent = nodes.find(n => n.id === node.parentId);
                    
                    // Calculate absolute position
                    let newPos = { ...node.position };
                    if (parent) {
                        newPos = {
                            x: parent.position.x + node.position.x,
                            y: parent.position.y + node.position.y
                        };
                    }
                    
                    // Sanitize (remove Rack constraints)
                    const sanitizedNode = sanitizeNodeForClipboard(node);
                    
                    const updatedNode = {
                        ...sanitizedNode,
                        id: nodeId,
                        parentId: undefined,
                        extent: undefined,
                        position: newPos,
                        draggable: true,
                        hidden: false,
                        style: { ...sanitizedNode.style, width: undefined, height: undefined },
                        data: {
                            ...sanitizedNode.data,
                            collapsed: false, 
                            handlePosition: 'top-bottom'
                        }
                    };
                    
                    // Update nodes list
                    let finalNodes = nodes.map(n => n.id === nodeId ? updatedNode : n);
                    
                    // Trigger Layout Fix (Old parent might shrink)
                    finalNodes = fixRackLayout(finalNodes) as SynniaNode[];
                    
                    set({ nodes: sortNodesTopologically(finalNodes) });
                },
        
                toggleGroupCollapse: (groupId: string) => {            const { nodes } = get();
            const group = nodes.find(n => n.id === groupId);
            if (!group) return;
            
            const isCollapsing = !group.data.collapsed;
            let updatedNodes = [];
            
            if (isCollapsing) {
                updatedNodes = applyRackCollapse(nodes, group);
            } else {
                updatedNodes = applyRackExpand(nodes, group);
            }
            
            // Re-calculate global layout to handle nested rack resizing
            updatedNodes = fixRackLayout(updatedNodes);
            
            set({ nodes: updatedNodes });
        },

        toggleNodeCollapse: (nodeId: string) => {
            const { nodes } = get();
            let updatedNodes = nodes.map(n => {
                if (n.id === nodeId) {
                    const willBeCollapsed = !n.data.collapsed;
                    const newStyle = { ...n.style };
                    
                    // If expanding and height is missing, set a default to prevent layout shrinking
                    if (!willBeCollapsed && !newStyle.height) {
                         newStyle.height = 200; 
                    }
                    
                    return { 
                        ...n, 
                        style: newStyle,
                        data: { ...n.data, collapsed: willBeCollapsed } 
                    };
                }
                return n;
            });
            
            updatedNodes = fixRackLayout(updatedNodes);

            set({ nodes: updatedNodes });
        },
        
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

        createRackFromSelection: () => {
           const { nodes } = get();
           const selectedNodes = nodes.filter(n => n.selected && n.type !== NodeType.RACK && n.type !== NodeType.GROUP);
           
           if (selectedNodes.length === 0) return;
           
           const minX = Math.min(...selectedNodes.map(n => n.position.x));
           const minY = Math.min(...selectedNodes.map(n => n.position.y));
           
           const rackId = uuidv4();
           
           const rackNode: SynniaNode = {
               id: rackId,
               type: NodeType.RACK,
               position: { x: minX - 20, y: minY - 50 },
               data: { title: 'New Rack', state: 'idle' },
               style: { width: 300, height: 400 },
               selected: true,
               draggable: true
           };
           
           const sortedNodes = [...selectedNodes].sort((a, b) => a.position.y - b.position.y);
           
           const updatedChildren = sortedNodes.map(node => ({
               ...node,
               parentId: rackId,
               extent: 'parent',
               position: { x: 0, y: 0 },
               selected: false,
               data: { ...node.data, collapsed: true } // Force collapse for Rack
           } as SynniaNode));
           
           const selectedIds = new Set(selectedNodes.map(n => n.id));
           const unselectedNodes = nodes.filter(n => !selectedIds.has(n.id));

           let allNodes = [...unselectedNodes, rackNode, ...updatedChildren];
           
           allNodes = fixRackLayout(allNodes) as SynniaNode[];
           
           set({ nodes: sortNodesTopologically(allNodes) });
        },

        duplicateNode: (node: SynniaNode, position?: XYPosition) => {
           const { nodes, assets, createAsset } = get();
           const newId = uuidv4();
           
           // Sanitize Data for Duplicate
           const sanitizedNode = sanitizeNodeForClipboard(node);

           // Architecture V2: Deep Copy Asset
           let newAssetId = sanitizedNode.data.assetId;
           if (newAssetId && assets[newAssetId]) {
               const originalAsset = assets[newAssetId];
               // Simple deep clone for content
               const contentClone = originalAsset.content ? JSON.parse(JSON.stringify(originalAsset.content)) : originalAsset.content;
               
               newAssetId = createAsset(
                   originalAsset.type, 
                   contentClone,
                   { 
                       name: `${originalAsset.metadata.name} (Copy)`,
                       source: 'user'
                   }
               );
           }
           
           const newNode: SynniaNode = {
             ...sanitizedNode,
             id: newId,
             position: position || { x: node.position.x + 20, y: node.position.y + 20 },
             selected: true,
             parentId: node.parentId,
             extent: node.extent,
             data: {
                 ...sanitizedNode.data,
                 assetId: newAssetId
             }
           };
           
           const deselectedNodes = nodes.map(n => ({ ...n, selected: false }));
           const finalNodes = sortNodesTopologically([...deselectedNodes, newNode]);
           set({ nodes: finalNodes });
        },

        handleAltDragStart: (nodeId: string) => {
            const { nodes, edges } = get();
            const node = nodes.find(n => n.id === nodeId);
            if (!node) return ""; 
        
            // 1. Identify Tree to Clone (Root + Descendants)
            const nodesToClone = [node, ...getDescendants(nodes, node.id)];
            const idMap = new Map<string, string>();
            nodesToClone.forEach(n => idMap.set(n.id, uuidv4()));

            // 2. Create Stationary Clones (Left behind) - Preserve State (e.g. inside Rack)
            const stationaryNodes = nodesToClone.map(original => {
                const newId = idMap.get(original.id)!;
                
                let newParentId = original.parentId;
                if (original.parentId && idMap.has(original.parentId)) {
                    newParentId = idMap.get(original.parentId);
                }
                
                return {
                    ...original,
                    id: newId,
                    parentId: newParentId,
                    selected: false,
                    data: JSON.parse(JSON.stringify(original.data))
                };
            });

            // 3. Clone Edges for Stationary Nodes
            const newEdges: SynniaEdge[] = [];
            edges.forEach(edge => {
                const sourceIsCloned = idMap.has(edge.source);
                const targetIsCloned = idMap.has(edge.target);
                
                if (sourceIsCloned || targetIsCloned) {
                    const newEdge = {
                        ...edge,
                        id: uuidv4(),
                        source: sourceIsCloned ? idMap.get(edge.source)! : edge.source,
                        target: targetIsCloned ? idMap.get(edge.target)! : edge.target,
                        selected: false
                    };
                    newEdges.push(newEdge);
                }
            });

            // 4. Detach Moving Root Node - Sanitize State (Dragging out)
            let newPosition = node.position;
            let newParentId = node.parentId;
            let newExtent = node.extent;

            if (node.parentId) {
                const parentNode = nodes.find(n => n.id === node.parentId);
                if (parentNode) {
                    newPosition = {
                        x: parentNode.position.x + node.position.x,
                        y: parentNode.position.y + node.position.y
                    };
                    newParentId = undefined;
                    newExtent = undefined;
                }
            }
            
            const sanitizedNode = sanitizeNodeForClipboard(node);

            const updatedMovingNode = {
                ...sanitizedNode,
                parentId: newParentId,
                position: newPosition,
                extent: newExtent,
                style: { ...sanitizedNode.style, opacity: 0.5 },
                data: {
                    ...sanitizedNode.data,
                    isReference: true
                }
            };
            
            // 5. Apply Changes
            const finalNodes = nodes.map(n => n.id === nodeId ? updatedMovingNode : n).concat(stationaryNodes);

            set({
                nodes: sortNodesTopologically(finalNodes),
                edges: [...edges, ...newEdges]
            });
            
            return idMap.get(node.id)!;
        },
        
        handleDragStopOpacity: (nodeId: string) => {
             set(state => ({
                 nodes: state.nodes.map(n => {
                    if (n.id === nodeId) {
                        const { opacity, ...restStyle } = n.style || {};
                        return { ...n, style: { ...restStyle, opacity: 1 } };
                    }
                    return n;
                 })
             }));
        },

        onNodesChange: (changes: NodeChange<SynniaNode>[]) => {
          const { nodes } = get();
          const updatedNodes = applyNodeChanges(changes, nodes) as SynniaNode[];
          
          // Detect dimension changes to nodes inside Racks/Collapsed Groups
          // This ensures layout recalculation when a child expands/resizes
          const shouldRelayout = changes.some(c => {
               if (c.type !== 'dimensions') return false;
               const node = updatedNodes.find(n => n.id === c.id);
               if (!node || !node.parentId) return false;
               
               const parent = updatedNodes.find(p => p.id === node.parentId);
               return parent && (parent.type === NodeType.RACK || (parent.type === NodeType.GROUP && parent.data.collapsed));
          });
          
          if (shouldRelayout) {
               set({ nodes: fixRackLayout(updatedNodes) });
          } else {
               set({ nodes: updatedNodes });
          }
        },

        onEdgesChange: (changes: EdgeChange<SynniaEdge>[]) => {
          set({
            edges: applyEdgeChanges(changes, get().edges),
          });
        },

        onConnect: (connection: Connection) => {
          set({
            edges: addEdge(connection, get().edges),
          });
        },
        
        onNodeDrag: (_event, node) => {
           const { nodes } = get();
           const groups = nodes.filter(n => (n.type === NodeType.GROUP || n.type === NodeType.RACK) && n.id !== node.id);
           const intersectingGroups = groups.filter(group => isNodeInsideGroup(node, group));
           
           let targetGroup = null;
           if (intersectingGroups.length > 0) {
             targetGroup = intersectingGroups.reduce((prev, curr) => {
               const prevArea = (prev.measured?.width || 0) * (prev.measured?.height || 0);
               const currArea = (curr.measured?.width || 0) * (curr.measured?.height || 0);
               return prevArea < currArea ? prev : curr;
             });
           }
           
           const currentHighlight = get().highlightedGroupId;
           const newHighlight = targetGroup ? targetGroup.id : null;
           
           if (currentHighlight !== newHighlight) {
             set({ highlightedGroupId: newHighlight });
           }
        },

        onNodeDragStop: (_event, node) => {
           set({ highlightedGroupId: null }); 
           
           const { nodes } = get();
           const groups = nodes.filter((n) => (n.type === NodeType.GROUP || n.type === NodeType.RACK) && n.id !== node.id);
           
           const intersectingGroups = groups.filter(group => isNodeInsideGroup(node, group));
           let targetGroup = null;
           if (intersectingGroups.length > 0) {
             targetGroup = intersectingGroups.reduce((prev, curr) => {
               const prevArea = (prev.measured?.width || 0) * (prev.measured?.height || 0);
               const currArea = (curr.measured?.width || 0) * (curr.measured?.height || 0);
               return prevArea < currArea ? prev : curr;
             });
           }
           
           let hasGrouped = false;
           
           if (targetGroup && node.parentId !== targetGroup.id) {
             
             // Prevent Group/Rack Nesting
             if (node.type === NodeType.GROUP || node.type === NodeType.RACK) {
                 return;
             }

             // Architecture V2: Strategy Pattern
             // Strategy needs to handle RACK insertion (auto-collapse)
             const strategy = getContainerStrategy(targetGroup);
             
             if (strategy) {
                 const result = strategy.onDrop(nodes, node as SynniaNode, targetGroup);
                 if (result.handled) {
                     set({ nodes: sortNodesTopologically(result.updatedNodes) });
                     hasGrouped = true;
                 }
             }
           } 
           
           if (!hasGrouped) {
               set(state => ({ nodes: [...state.nodes] }));
           }
        },

        onNodeDragStart: (_event, node) => {
           // Placeholder
        },

        triggerCommit: () => {
            set(state => ({ nodes: [...state.nodes] }));
        },

        addNode: (type: NodeType, position: XYPosition, options = {}) => {
          const config = nodesConfig[type];
          const isGroup = type === NodeType.GROUP;
          
          let assetId = options.assetId;
          
          // Architecture V2: Automatically create backing asset for Asset Nodes
          if ((type === NodeType.ASSET || type === NodeType.RECIPE) && !assetId) {
               let assetType = options.assetType;
               let content = options.content;
               const name = options.assetName || config.title;
               const extraMeta = options.metadata || {};

               if (type === NodeType.RECIPE) {
                   assetType = 'json';
                   if (!content) {
                       // Initialize as Form Asset
                       content = { schema: [], values: {} };
                   }
               } else {
                   // Default ASSET
                   assetType = assetType || 'text';
                   content = content || '';
               }
               
               // Default to a generic Asset for now
               assetId = get().createAsset(assetType, content, { name, ...extraMeta });
          }

          const nodeTitle = options.assetName || config.title;

          const newNode: SynniaNode = {
            id: uuidv4(),
            type,
            position,
            data: {
              title: nodeTitle,
              state: 'idle',
              assetId,
            },
            ...(isGroup ? {
              style: { width: 400, height: 300 },
            } : {}),
            style: options.style || {},
          };

          const newNodes = [...get().nodes, newNode];
          set({ nodes: sortNodesTopologically(newNodes) });
          
          return newNode.id;
        },

        pasteNodes: (copiedNodes: SynniaNode[]) => {
           const { nodes, assets, createAsset } = get();
           const idMap = new Map<string, string>();
           copiedNodes.forEach(n => idMap.set(n.id, uuidv4()));

           const newNodes = copiedNodes.map(node => {
               const newId = idMap.get(node.id)!;
               
               let newParentId = node.parentId;
               if (node.parentId && idMap.has(node.parentId)) {
                   newParentId = idMap.get(node.parentId);
               } else {
                   newParentId = undefined; 
               }

               // Sanitize for Paste
               const sanitizedNode = sanitizeNodeForClipboard(node);
               
               // Architecture V2: Clone Asset
               let newAssetId = sanitizedNode.data.assetId;
               if (newAssetId) {
                   if (assets[newAssetId]) {
                       // Asset exists in store -> Clone it
                       const originalAsset = assets[newAssetId];
                       const contentClone = originalAsset.content ? JSON.parse(JSON.stringify(originalAsset.content)) : originalAsset.content;
                       newAssetId = createAsset(
                           originalAsset.type,
                           contentClone,
                           { name: `${originalAsset.metadata.name} (Copy)` }
                       );
                   } else {
                       // Asset ID exists but not in store (broken link/external paste) -> Create Placeholder
                       newAssetId = createAsset(
                           'text', 
                           'Content unavailable (Source asset missing)', 
                           { name: 'Missing Asset' }
                       );
                   }
               }

               return {
                   ...sanitizedNode,
                   id: newId,
                   parentId: newParentId,
                   extent: newParentId ? 'parent' : undefined,
                   selected: true, 
                   position: { 
                       x: node.position.x + 50, 
                       y: node.position.y + 50 
                   },
                   data: {
                       ...sanitizedNode.data,
                       assetId: newAssetId
                   }
               } as SynniaNode;
           });

           const deselectedNodes = nodes.map(n => ({ ...n, selected: false }));
           const finalNodes = sortNodesTopologically([...deselectedNodes, ...newNodes]);
           set({ nodes: finalNodes });
        },

        pasteNodesAsShortcut: (copiedNodes: SynniaNode[]) => {
            // TODO: Implement shortcut pasting logic
            console.warn("pasteNodesAsShortcut not implemented");
        },

        removeNode: (id: string) => {
          const { nodes, edges } = get();
          
          const nodesToDelete = new Set<string>();
          const queue = [id];
          
          while(queue.length > 0) {
            const currentId = queue.pop()!;
            nodesToDelete.add(currentId);
            
            const children = nodes.filter(n => n.parentId === currentId);
            children.forEach(child => queue.push(child.id));
          }
          
          const filteredNodes = nodes.filter((n) => !nodesToDelete.has(n.id));
          const finalNodes = fixRackLayout(filteredNodes) as SynniaNode[];

          set({
            nodes: finalNodes,
            edges: edges.filter((e) => !nodesToDelete.has(e.source) && !nodesToDelete.has(e.target)),
          });
        },

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
