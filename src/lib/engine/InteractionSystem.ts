import { GraphEngine } from './GraphEngine';
import { 
    OnNodeDrag, 
    OnConnect, 
    OnNodesChange, 
    OnEdgesChange, 
    NodeChange,
    EdgeChange,
    Connection,
    applyNodeChanges,
    applyEdgeChanges,
    addEdge
} from '@xyflow/react';
import { SynniaNode, NodeType, SynniaEdge } from '@/types/project';
import { isNodeInsideGroup, sortNodesTopologically } from '@/lib/graphUtils';
import { fixRackLayout } from '@/lib/rackLayout';
import { getContainerStrategy } from '@/lib/strategies/registry';
import { useWorkflowStore } from '@/store/workflowStore';
import { v4 as uuidv4 } from 'uuid';
import { getDescendants, sanitizeNodeForClipboard } from '@/lib/graphUtils';

export class InteractionSystem {
    private engine: GraphEngine;

    constructor(engine: GraphEngine) {
        this.engine = engine;
    }
    
    public handleAltDragStart(nodeId: string): string {
            const { nodes, edges } = this.engine.state;
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
                } as SynniaNode;
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
            } as SynniaNode;
            
            // 5. Apply Changes
            const finalNodes = nodes.map(n => n.id === nodeId ? updatedMovingNode : n).concat(stationaryNodes);

            this.engine.setNodes(sortNodesTopologically(finalNodes));
            this.engine.setEdges([...edges, ...newEdges]);
            
            return idMap.get(node.id)!;
    }

    public handleDragStopOpacity(nodeId: string) {
             const { nodes } = this.engine.state;
             const updatedNodes = nodes.map(n => {
                if (n.id === nodeId) {
                    const { opacity, ...restStyle } = n.style || {};
                    return { ...n, style: { ...restStyle, opacity: 1 } };
                }
                return n;
             }) as SynniaNode[];
             this.engine.setNodes(updatedNodes);
    }

    public onNodesChange: OnNodesChange<SynniaNode> = (changes) => {
        const { nodes } = this.engine.state;
        const updatedNodes = applyNodeChanges(changes, nodes) as SynniaNode[];
        
        // Detect dimension changes to nodes inside Racks/Collapsed Groups
        const shouldRelayout = changes.some(c => {
             if (c.type !== 'dimensions') return false;
             // Only care if dimension update actually happened (sometimes it fires without change)
             // We check the node in updatedNodes
             const node = updatedNodes.find(n => n.id === c.id);
             if (!node || !node.parentId) return false;
             
             const parent = updatedNodes.find(p => p.id === node.parentId);
             return parent && (parent.type === NodeType.RACK || (parent.type === NodeType.GROUP && parent.data.collapsed));
        });
        
        if (shouldRelayout) {
             this.engine.setNodes(fixRackLayout(updatedNodes));
        } else {
             this.engine.setNodes(updatedNodes);
        }
    };

    public onEdgesChange: OnEdgesChange<SynniaEdge> = (changes) => {
        const { edges } = this.engine.state;
        this.engine.setEdges(applyEdgeChanges(changes, edges) as SynniaEdge[]);
    };

    public onConnect: OnConnect = (connection) => {
        const { edges } = this.engine.state;
        this.engine.setEdges(addEdge(connection, edges) as SynniaEdge[]);
    };

    public onNodeDrag: OnNodeDrag = (_event, node) => {
         const { nodes, highlightedGroupId } = this.engine.state;
         
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
         
         const newHighlight = targetGroup ? targetGroup.id : null;
         
         if (highlightedGroupId !== newHighlight) {
           useWorkflowStore.setState({ highlightedGroupId: newHighlight });
         }
    };

    public onNodeDragStop: OnNodeDrag = (_event, node) => {
         useWorkflowStore.setState({ highlightedGroupId: null });
         
         const { nodes } = this.engine.state;
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
           // Prevent Group/Rack Nesting (for now)
           if (node.type === NodeType.GROUP || node.type === NodeType.RACK) {
               return;
           }

           const strategy = getContainerStrategy(targetGroup);
           
           if (strategy) {
               const result = strategy.onDrop(nodes, node as SynniaNode, targetGroup);
               if (result.handled) {
                   this.engine.setNodes(sortNodesTopologically(result.updatedNodes));
                   hasGrouped = true;
               }
           }
         } 
         
         if (!hasGrouped) {
             // Just trigger update to ensure state consistency (optional)
             this.engine.setNodes([...nodes]);
         }
    };
}
