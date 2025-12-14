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
        // OR dimension changes to nodes in a docked chain
        const shouldGlobalLayout = changes.some(c => {
            if (c.type !== 'dimensions') return false;
            const node = updatedNodes.find(n => n.id === c.id);
            if (!node) return false;

            // Check if inside Rack/Collapsed Group
            if (node.parentId) {
                const parent = updatedNodes.find(p => p.id === node.parentId);
                if (parent && (parent.type === NodeType.RACK || (parent.type === NodeType.GROUP && parent.data.collapsed))) {
                    return true;
                }
            }

            // Check if part of a docked chain (master or follower)
            const isDockedMaster = updatedNodes.some(n => n.data.dockedTo === node.id);
            const isDockedFollower = !!node.data.dockedTo;
            return isDockedMaster || isDockedFollower;
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

        // === Undock on Drag Away ===
        // If this node is docked to another, check if it's being dragged too far away
        const dockedTo = (node.data as any)?.dockedTo;
        if (dockedTo) {
            const master = nodes.find(n => n.id === dockedTo);
            if (master) {
                const UNDOCK_THRESHOLD = 50; // pixels to trigger undock
                const masterBottom = master.position.y + (master.measured?.height ?? master.height ?? 100);
                const nodeTop = node.position.y;
                const distance = Math.abs(nodeTop - masterBottom);

                // Check horizontal alignment too
                const masterX = master.position.x;
                const nodeX = node.position.x;
                const xDistance = Math.abs(nodeX - masterX);

                if (distance > UNDOCK_THRESHOLD || xDistance > UNDOCK_THRESHOLD) {
                    // Undock: clear dockedTo
                    this.engine.updateNode(node.id, {
                        data: { dockedTo: undefined }
                    });

                    // Trigger layout fix to update hasDockedFollower on master
                    const updatedNodes = this.engine.layout.fixDockingLayout(this.engine.state.nodes);
                    this.engine.setNodes(updatedNodes);
                }
            }
        }

        // Only target top-level containers that are not the node itself
        const targets = nodes.filter(n =>
            (n.type === NodeType.RACK || n.type === NodeType.GROUP) &&
            n.id !== node.id &&
            !n.parentId
        );

        let foundId: string | null = null;
        // Find topmost intersecting container
        for (let i = targets.length - 1; i >= 0; i--) {
            if (isNodeInsideGroup(node as SynniaNode, targets[i])) {
                foundId = targets[i].id;
                break;
            }
        }

        // Optimization: Only update store if changed
        if (highlightedGroupId !== foundId) {
            useWorkflowStore.setState({ highlightedGroupId: foundId });
        }

        // === Dock Preview Detection ===
        // Check if this JSON node is near another JSON node for docking preview
        if (node.type === NodeType.JSON && !dockedTo) {
            const DOCK_PREVIEW_THRESHOLD = 50;
            const nodeTop = node.position.y;
            const nodeWidth = node.measured?.width ?? node.width ?? 200;

            // Find nearby JSON nodes that could be docking targets
            const potentialTargets = nodes.filter(n =>
                n.type === NodeType.JSON &&
                n.id !== node.id &&
                !n.parentId &&
                !(n.data as any).hasDockedFollower
            );

            let previewTarget: string | null = null;

            for (const target of potentialTargets) {
                const targetBottom = target.position.y + (target.measured?.height ?? target.height ?? 100);
                const targetWidth = target.measured?.width ?? target.width ?? 200;

                // Check horizontal alignment
                const xOverlap = Math.min(node.position.x + nodeWidth, target.position.x + targetWidth) -
                    Math.max(node.position.x, target.position.x);
                if (xOverlap < nodeWidth * 0.3) continue;

                // Check if node top is near target bottom
                const distance = Math.abs(nodeTop - targetBottom);
                if (distance < DOCK_PREVIEW_THRESHOLD) {
                    // Validate schema match
                    if (this.schemasMatch(node as SynniaNode, target, this.engine.state.assets)) {
                        previewTarget = target.id;
                        break;
                    }
                }
            }

            // Update preview only if changed
            const currentPreview = useWorkflowStore.getState().dockPreviewId;
            if (currentPreview !== previewTarget) {
                useWorkflowStore.setState({ dockPreviewId: previewTarget });
            }
        }
    };

    public onNodeDragStop: OnNodeDrag = (_event, node) => {
        // Clear highlight and dock preview
        useWorkflowStore.setState({ highlightedGroupId: null, dockPreviewId: null });

        const { nodes, assets } = this.engine.state;

        // === JSON Auto-Docking ===
        if (node.type === NodeType.JSON) {
            const DOCK_THRESHOLD = 50; // pixels to trigger dock (matching preview)
            const nodeTop = node.position.y;
            const nodeWidth = node.measured?.width ?? node.width ?? 200;

            // Find nearby JSON nodes that could be docking targets
            const potentialTargets = nodes.filter(n =>
                n.type === NodeType.JSON &&
                n.id !== node.id &&
                !n.parentId && // Both must be root nodes
                !(n.data as any).hasDockedFollower // Target must not already have a follower
            );

            let bestTarget: SynniaNode | null = null;
            let bestDistance = Infinity;

            for (const target of potentialTargets) {
                const targetBottom = target.position.y + (target.measured?.height ?? target.height ?? 100);
                const targetWidth = target.measured?.width ?? target.width ?? 200;

                // Check horizontal alignment (must overlap significantly)
                const xOverlap = Math.min(node.position.x + nodeWidth, target.position.x + targetWidth) -
                    Math.max(node.position.x, target.position.x);
                if (xOverlap < nodeWidth * 0.3) continue;

                // Check if node TOP is near target BOTTOM (node will dock below target)
                const distance = Math.abs(nodeTop - targetBottom);
                if (distance < DOCK_THRESHOLD && distance < bestDistance) {
                    // Validate schema match
                    if (this.schemasMatch(node as SynniaNode, target, assets)) {
                        bestTarget = target;
                        bestDistance = distance;
                    }
                }
            }

            if (bestTarget) {
                // Dock: set dockedTo and snap position
                const targetHeight = bestTarget.measured?.height ?? bestTarget.height ?? 100;
                const targetWidth = bestTarget.measured?.width ?? bestTarget.width ?? 200;

                this.engine.updateNode(node.id, {
                    position: {
                        x: bestTarget.position.x,
                        y: bestTarget.position.y + targetHeight
                    },
                    data: { dockedTo: bestTarget.id },
                    style: { width: targetWidth },
                    width: targetWidth
                });

                // Trigger docking layout fix
                const updatedNodes = this.engine.layout.fixDockingLayout(this.engine.state.nodes);
                this.engine.setNodes(updatedNodes);
                return;
            }
        }

        // === Container Reparenting (existing logic) ===
        const targets = nodes.filter(n =>
            (n.type === NodeType.RACK || n.type === NodeType.GROUP) &&
            n.id !== node.id &&
            !n.parentId
        );

        if (node.parentId) return;

        let droppedTarget: SynniaNode | null = null;

        for (let i = targets.length - 1; i >= 0; i--) {
            const target = targets[i];
            if (isNodeInsideGroup(node, target)) {
                droppedTarget = target;
                break;
            }
        }

        if (droppedTarget) {
            this.engine.reparentNode(node.id, droppedTarget.id);
        }
    };

    /**
     * Check if two JSON nodes have matching schemas.
     */
    private schemasMatch(
        nodeA: SynniaNode,
        nodeB: SynniaNode,
        assets: Record<string, any>
    ): boolean {
        const assetA = nodeA.data.assetId ? assets[nodeA.data.assetId] : null;
        const assetB = nodeB.data.assetId ? assets[nodeB.data.assetId] : null;

        if (!assetA || !assetB) return false;

        const schemaA = assetA.content?.schema;
        const schemaB = assetB.content?.schema;

        if (!Array.isArray(schemaA) || !Array.isArray(schemaB)) return false;
        if (schemaA.length !== schemaB.length) return false;

        // Compare by key
        const keysA = schemaA.map((f: any) => f.key).sort();
        const keysB = schemaB.map((f: any) => f.key).sort();

        return JSON.stringify(keysA) === JSON.stringify(keysB);
    }
}
