import { GraphEngine } from './GraphEngine';
import {
    OnNodeDrag,
    OnConnect,
    OnNodesChange,
    OnEdgesChange,
    applyNodeChanges,
    applyEdgeChanges,
    addEdge
} from '@xyflow/react';
import { SynniaNode, NodeType, SynniaEdge } from '@/types/project';
import { sortNodesTopologically } from '@/lib/graphUtils';
import { v4 as uuidv4 } from 'uuid';
import { getDescendants, sanitizeNodeForClipboard, isNodeInsideGroup } from '@/lib/graphUtils';
import { useWorkflowStore } from '@/store/workflowStore';

export class InteractionSystem {
    private engine: GraphEngine;
    private dockingLayoutScheduled = false;  // Throttle flag for docking layout

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
        const shouldGlobalLayout = changes.some(c => {
            if (c.type !== 'dimensions') return false;
            const node = updatedNodes.find(n => n.id === c.id);
            if (!node || !node.parentId) return false;

            const parent = updatedNodes.find(p => p.id === node.parentId);
            return parent && (parent.type === NodeType.RACK || (parent.type === NodeType.GROUP && parent.data.collapsed));
        });

        let finalNodes = updatedNodes;

        if (shouldGlobalLayout) {
            // Rack layout fixes (which includes docking fix at the end)
            finalNodes = this.engine.layout.fixGlobalLayout(updatedNodes);
            this.engine.setNodes(finalNodes);
        } else {
            // Check if any node has docking relationships before running expensive layout
            const hasDocking = updatedNodes.some(n => n.data.dockedTo);

            if (hasDocking && !this.dockingLayoutScheduled) {
                // Throttle docking layout using requestAnimationFrame
                this.dockingLayoutScheduled = true;
                requestAnimationFrame(() => {
                    this.dockingLayoutScheduled = false;
                    const currentNodes = this.engine.state.nodes;
                    const laidOutNodes = this.engine.layout.fixDockingLayout(currentNodes);
                    this.engine.setNodes(laidOutNodes);
                });
            }

            // Always apply node changes immediately for smooth dragging
            this.engine.setNodes(updatedNodes);
        }
    };

    public onEdgesChange: OnEdgesChange<SynniaEdge> = (changes) => {
        const { edges } = this.engine.state;
        this.engine.setEdges(applyEdgeChanges(changes, edges) as SynniaEdge[]);
    };

    public onConnect: OnConnect = (connection) => {
        const { nodes, edges } = this.engine.state;

        // Cycle detection: check if adding this edge would create a cycle
        if (this.wouldCreateCycle(nodes, edges, connection)) {
            // Import toast dynamically to avoid circular deps
            import('sonner').then(({ toast }) => {
                toast.error('Cannot create connection: would create a cycle');
            });
            return;
        }

        this.engine.setEdges(addEdge(connection, edges) as SynniaEdge[]);
    };

    /**
     * Check if adding a new edge would create a cycle in the graph.
     * Uses DFS from target to see if we can reach source.
     */
    private wouldCreateCycle(
        nodes: SynniaNode[],
        edges: SynniaEdge[],
        newConnection: { source: string; target: string }
    ): boolean {
        const { source, target } = newConnection;

        // Self-loop detection (same node or same handle on same node)
        if (source === target) return true;

        // DFS from target to see if we can reach source
        const visited = new Set<string>();
        const stack = [target];

        while (stack.length > 0) {
            const nodeId = stack.pop()!;
            if (nodeId === source) return true; // Would create cycle
            if (visited.has(nodeId)) continue;
            visited.add(nodeId);

            // Find all edges where this node is the source
            edges
                .filter(e => e.source === nodeId)
                .forEach(e => stack.push(e.target));
        }

        return false;
    }

    public onNodeDrag: OnNodeDrag = (_event, node) => {
        // Detect hover over Rack/Group for highlighting
        const { nodes, highlightedGroupId } = this.engine.state;

        // Only target top-level containers that are not the node itself
        const targets = nodes.filter(n =>
            (n.type === NodeType.RACK || n.type === NodeType.GROUP) &&
            n.id !== node.id &&
            !n.parentId
        );

        let foundId: string | null = null;
        // Find topmost intersecting container
        for (let i = targets.length - 1; i >= 0; i--) {
            if (isNodeInsideGroup(node, targets[i])) {
                foundId = targets[i].id;
                break;
            }
        }

        // Optimization: Only update store if changed
        if (highlightedGroupId !== foundId) {
            useWorkflowStore.setState({ highlightedGroupId: foundId });
        }
    };

    public onNodeDragStop: OnNodeDrag = (_event, node) => {
        // Clear highlight
        useWorkflowStore.setState({ highlightedGroupId: null });

        // 1. Get Potential Targets (Racks or Groups)
        // Only consider top-level containers for now to avoid complexity with nested coordinate systems during drag detection
        const targets = this.engine.state.nodes.filter(n =>
            (n.type === NodeType.RACK || n.type === NodeType.GROUP) &&
            n.id !== node.id &&
            !n.parentId // Target must be a root container
        );

        // If dragging a nested node, we might need world position calculation. 
        // For "New Node -> Rack", the node is root (parentId is undefined), so direct comparison works.
        if (node.parentId) return;

        let droppedTarget: SynniaNode | null = null;

        // 2. Find Intersection (Topmost first)
        for (let i = targets.length - 1; i >= 0; i--) {
            const target = targets[i];
            if (isNodeInsideGroup(node, target)) {
                droppedTarget = target;
                break;
            }
        }

        // 3. Reparent
        if (droppedTarget) {
            // This triggers VerticalStackBehavior.onChildAdd automatically
            this.engine.reparentNode(node.id, droppedTarget.id);
        }
    };
}
