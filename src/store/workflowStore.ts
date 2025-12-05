import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { temporal } from 'zundo';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Connection,
  Edge,
  EdgeChange,
  NodeChange,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
  XYPosition,
  Node,
  OnNodeDrag,
} from '@xyflow/react';
import { SynniaNode, NodeType, SynniaEdge } from '@/types/project';
import { nodesConfig } from '@/components/workflow/nodes/registry';
import { v4 as uuidv4 } from 'uuid';

let isHistoryPaused = false;

export interface WorkflowState {
  nodes: SynniaNode[];
  edges: SynniaEdge[];
  highlightedGroupId: string | null;
}

export interface WorkflowActions {
  onNodesChange: OnNodesChange<SynniaNode>;
  onEdgesChange: OnEdgesChange<SynniaEdge>;
  onConnect: OnConnect;
  onNodeDragStop: OnNodeDrag;
  onNodeDragStart: OnNodeDrag;
  onNodeDrag: OnNodeDrag;
  
  addNode: (type: NodeType, position: XYPosition) => string;
  removeNode: (id: string) => void;
  updateNodeData: (id: string, data: Partial<SynniaNode['data']>) => void;
  
  setWorkflow: (nodes: SynniaNode[], edges: SynniaEdge[]) => void;
  triggerCommit: () => void;
  pasteNodes: (copiedNodes: SynniaNode[]) => void;

  pauseHistory: () => void;
  resumeHistory: () => void;
}

// Helper: 检测 node 是否在 group 内部
const isNodeInsideGroup = (node: Node, group: Node) => {
  if (!node.measured || !group.measured) return false;
  
  const nodeX = node.position.x;
  const nodeY = node.position.y;
  const nodeW = node.measured.width || 0;
  const nodeH = node.measured.height || 0;

  const groupX = group.position.x;
  const groupY = group.position.y;
  const groupW = group.measured.width || 0;
  const groupH = group.measured.height || 0;

  const centerX = nodeX + nodeW / 2;
  const centerY = nodeY + nodeH / 2;

  return (
    centerX > groupX &&
    centerX < groupX + groupW &&
    centerY > groupY &&
    centerY < groupY + groupH
  );
};

// Helper: 拓扑排序，确保 Parent 在 Child 前面
const sortNodesTopologically = (nodes: SynniaNode[]): SynniaNode[] => {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const childrenMap = new Map<string, string[]>();
  const roots: string[] = [];

  nodes.forEach(node => {
    if (!node.parentId || !nodeMap.has(node.parentId)) {
      roots.push(node.id);
    } else {
      const existing = childrenMap.get(node.parentId) || [];
      existing.push(node.id);
      childrenMap.set(node.parentId, existing);
    }
  });

  // 根节点排序：Group 优先
  roots.sort((a, b) => {
    const nodeA = nodeMap.get(a)!;
    const nodeB = nodeMap.get(b)!;
    if (nodeA.type === NodeType.GROUP && nodeB.type !== NodeType.GROUP) return -1;
    if (nodeA.type !== NodeType.GROUP && nodeB.type === NodeType.GROUP) return 1;
    return 0;
  });

  const result: SynniaNode[] = [];
  const queue = [...roots];

  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = nodeMap.get(id);
    if (node) {
      result.push(node);
      const children = childrenMap.get(id);
      if (children) {
        // 子节点排序：Group 优先
        children.sort((a, b) => {
          const nodeA = nodeMap.get(a)!;
          const nodeB = nodeMap.get(b)!;
          if (nodeA.type === NodeType.GROUP && nodeB.type !== NodeType.GROUP) return -1;
          if (nodeA.type !== NodeType.GROUP && nodeB.type === NodeType.GROUP) return 1;
          return 0;
        });
        
        children.forEach(childId => queue.push(childId));
      }
    }
  }

  return result;
};

export const useWorkflowStore = create<WorkflowState & WorkflowActions>()(
  subscribeWithSelector(
    temporal(
      (set, get) => ({
        nodes: [],
        edges: [],
        highlightedGroupId: null,

        pauseHistory: () => { isHistoryPaused = true; },
        resumeHistory: () => { isHistoryPaused = false; },

        onNodesChange: (changes: NodeChange<SynniaNode>[]) => {
          set({
            nodes: applyNodeChanges(changes, get().nodes),
          });
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
           const groups = nodes.filter(n => n.type === NodeType.GROUP && n.id !== node.id);
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
           const groups = nodes.filter((n) => n.type === NodeType.GROUP && n.id !== node.id);
           
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
             const updatedNodes = nodes.map((n) => {
                 if (n.id === node.id) {
                   return {
                     ...n,
                     parentId: targetGroup.id,
                     extent: 'parent',
                     position: {
                       x: node.position.x - targetGroup.position.x,
                       y: node.position.y - targetGroup.position.y,
                     },
                   } as SynniaNode;
                 }
                 return n;
               });

             set({ nodes: sortNodesTopologically(updatedNodes) });
             hasGrouped = true;
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

        addNode: (type: NodeType, position: XYPosition) => {
          const config = nodesConfig[type];
          const isGroup = type === NodeType.GROUP;
          
          const newNode: SynniaNode = {
            id: uuidv4(),
            type,
            position,
            data: {
              title: config.title,
              state: 'idle',
            },
            ...(isGroup ? {
              style: { width: 400, height: 300 },
            } : {})
          };

          const newNodes = [...get().nodes, newNode];
          set({ nodes: sortNodesTopologically(newNodes) });
          
          return newNode.id;
        },

        pasteNodes: (copiedNodes: SynniaNode[]) => {
           const { nodes } = get();
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

               return {
                   ...node,
                   id: newId,
                   parentId: newParentId,
                   // 关键修复：如果没有父节点，清除 extent 限制
                   extent: newParentId ? 'parent' : undefined,
                   selected: true, 
                   position: { 
                       x: node.position.x + 50, 
                       y: node.position.y + 50 
                   },
                   data: { ...JSON.parse(JSON.stringify(node.data)) } 
               } as SynniaNode;
           });

           const deselectedNodes = nodes.map(n => ({ ...n, selected: false }));
           const finalNodes = sortNodesTopologically([...deselectedNodes, ...newNodes]);
           set({ nodes: finalNodes });
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

          set({
            nodes: nodes.filter((n) => !nodesToDelete.has(n.id)),
            edges: edges.filter((e) => !nodesToDelete.has(e.source) && !nodesToDelete.has(e.target)),
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
        
        setWorkflow: (nodes, edges) => set({ nodes, edges }),
      }),
      {
        partialize: (state) => ({
          nodes: state.nodes,
          edges: state.edges,
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
