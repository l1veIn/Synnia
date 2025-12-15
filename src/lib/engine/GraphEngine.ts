import { useWorkflowStore, WorkflowState } from '@/store/workflowStore';
import { LayoutSystem } from './LayoutSystem';
import { InteractionSystem } from './InteractionSystem';
import { GraphMutator } from './GraphMutator';
import { AssetSystem } from './AssetSystem';
import { SynniaNode, SynniaEdge, NodeType } from '@/types/project';
import { addEdge, getConnectedEdges, Connection, Edge } from '@xyflow/react';
import { behaviorRegistry } from '@/lib/engine/BehaviorRegistry';
import { EngineContext, NodePatch } from '@/lib/engine/types/behavior';
import { sortNodesTopologically } from '@/lib/graphUtils';

export class GraphEngine {
    public layout: LayoutSystem;
    public interaction: InteractionSystem;
    public mutator: GraphMutator;
    public assets: AssetSystem;

    constructor() {
        this.layout = new LayoutSystem(this);
        this.interaction = new InteractionSystem(this);
        this.mutator = new GraphMutator(this);
        this.assets = new AssetSystem(this);
    }

    /**
     * Direct access to the Zustand store state.
     * Warning: This is a snapshot. Do not mutate directly.
     */
    get state(): WorkflowState {
        return useWorkflowStore.getState();
    }

    /**
     * Trigger a state update via the store.
     * This is the only way the Engine modifies the Model.
     */
    public setNodes(nodes: any[]) {
        useWorkflowStore.setState({ nodes });
    }

    public setEdges(edges: any[]) {
        useWorkflowStore.setState({ edges });
    }

    // =========================================================================
    // INSTRUCTION SET (PRIMITIVES) - MEMO
    // =========================================================================

    // --- 1. Hierarchy & Transform ---
    // [DONE] reparentNode: Smart move preserving absolute position.

    // --- 2. Selection & Focus ---
    // [DONE] selectNodes: Batch selection control.
    // [DONE] deselectAll: Global cleanup.

    // --- 3. Topology (Edges) ---
    // [DONE] connect: Safe edge creation using xyflow helper.
    // [DONE] disconnect: Remove specific edge.
    // [DONE] cleanNodeEdges: Cascade delete edges for a node.

    // --- 4. State & Locks ---
    // [DONE] lockNode: Toggle interactive capability.
    // [DONE] setNodeVisibility: Toggle hidden state.

    // =========================================================================
    // Level 1 Primitives: Atomic Operations
    // =========================================================================

    /**
     * Updates a single node by ID with partial data.
     * Handles immutability.
     */
    public updateNode(id: string, patch: Partial<SynniaNode>) {
        let nodes = this.state.nodes.map(n => {
            if (n.id === id) {
                return {
                    ...n,
                    ...patch,
                    style: patch.style ? { ...n.style, ...patch.style } : n.style,
                    data: patch.data ? { ...n.data, ...patch.data } : n.data
                };
            }
            return n;
        });

        // Trigger Layout Fix (Constraint Solving)
        nodes = this.layout.fixGlobalLayout(nodes);

        this.setNodes(nodes);
    }

    /**
     * Batch update multiple nodes at once.
     * Merges multiple patches for the same node ID sequentially.
     */
    public updateNodes(updates: { id: string, patch: Partial<SynniaNode> }[]) {
        const updateMap = new Map<string, Partial<SynniaNode>>();

        for (const u of updates) {
            const existing = updateMap.get(u.id) || {};

            // Merge logic: Accumulate changes
            updateMap.set(u.id, {
                ...existing,
                ...u.patch,
                // Shallow merge nested objects to avoid wiping out previous patch's partial data
                style: { ...(existing.style || {}), ...(u.patch.style || {}) },
                data: { ...(existing.data || {}), ...(u.patch.data || {}) }
            });
        }

        let nodes = this.state.nodes.map(n => {
            const patch = updateMap.get(n.id);
            if (patch) {
                return {
                    ...n,
                    ...patch,
                    // Note: We merge patch against original node state here
                    style: patch.style ? { ...n.style, ...patch.style } : n.style,
                    data: patch.data ? { ...n.data, ...patch.data } : n.data
                };
            }
            return n;
        });

        // Trigger Layout Fix
        nodes = this.layout.fixGlobalLayout(nodes);

        this.setNodes(nodes);
    }

    /**
     * Applies a list of NodePatch objects (Behavior API format).
     */
    public applyPatches(patches: NodePatch[]) {
        if (patches.length === 0) return;
        this.updateNodes(patches.map(p => ({ id: p.id, patch: p.patch })));
    }

    /**
     * Moves a node to a specific position (relative to its current parent).
     */
    public moveNode(id: string, position: { x: number, y: number }) {
        this.updateNode(id, { position });
    }

    /**
     * Resizes a node.
     */
    public resizeNode(id: string, dimensions: { width?: number, height?: number }) {
        this.updateNode(id, {
            width: dimensions.width,
            height: dimensions.height,
            style: { width: dimensions.width, height: dimensions.height }
        });
    }

    /**
     * Sets a node's parent and INTELLIGENTLY updates its position to maintain
     * visual consistency (World Position).
     * 
     * Formula: LocalPos = WorldPos - ParentWorldPos
     */
    public reparentNode(nodeId: string, newParentId: string | undefined) {
        this.reparentNodes([nodeId], newParentId);
    }

    /**
     * Batch version of reparentNode. 
     * Handles coordinate transformation AND Lifecycle Hooks (onChildAdd/Remove).
     */
    public reparentNodes(nodeIds: string[], newParentId: string | undefined) {
        const { nodes } = this.state;
        const targetNodes = nodes.filter(n => nodeIds.includes(n.id));
        if (targetNodes.length === 0) return;

        // 0. Prepare Context
        const context: EngineContext = {
            getNodes: () => this.state.nodes,
            getNode: (id) => this.state.nodes.find(n => n.id === id)
        };

        // 1. Calculate New Parent's Absolute Position (once)
        let newParentAbsPos = { x: 0, y: 0 };
        let newParentNode: SynniaNode | undefined;

        if (newParentId) {
            newParentNode = nodes.find(n => n.id === newParentId);
            const parentAbs = this.getNodeAbsolutePosition(newParentId, nodes);
            if (parentAbs) {
                newParentAbsPos = parentAbs;
            } else {
                console.warn(`New parent ${newParentId} not found, falling back to root.`);
            }
        }

        const pendingPatches: { id: string, patch: Partial<SynniaNode> }[] = [];

        targetNodes.forEach(node => {
            if (node.parentId === newParentId) return;

            // --- A. Lifecycle: Leave Old Parent ---
            if (node.parentId) {
                const oldParent = nodes.find(n => n.id === node.parentId);
                if (oldParent) {
                    const behavior = behaviorRegistry.getByType(oldParent.type as NodeType);
                    if (behavior.onChildRemove) {
                        const leavePatches = behavior.onChildRemove(oldParent, node, context);
                        // These patches might target the child (unlocking it) or the parent
                        leavePatches.forEach(p => pendingPatches.push(p));
                    }
                }
            }

            // --- B. Coordinate Transform ---
            // Calculate Node's current Absolute (World) Position
            const nodeAbsPos = this.getNodeAbsolutePosition(node.id, nodes);

            // If nodeAbsPos is null, node is invalid, skip transform but keep processing
            let newLocalPos = node.position;
            if (nodeAbsPos) {
                newLocalPos = {
                    x: nodeAbsPos.x - newParentAbsPos.x,
                    y: nodeAbsPos.y - newParentAbsPos.y
                };
            }

            // Push the reparent patch
            // Note: We use a distinct object because we might have collected patches for this node above
            // Logic below handles merging if multiple patches target same ID, or we just push separate updates
            // (updateNodes handles last-write-wins for same ID in map, so we should merge manually here or ensure order)
            // Ideally we merge all changes for 'node.id' into one patch object.

            // For simplicity in this loop, we push specific primitive updates.
            pendingPatches.push({
                id: node.id,
                patch: {
                    parentId: newParentId,
                    position: newLocalPos,
                    extent: newParentId ? 'parent' : undefined
                }
            });

            // --- C. Lifecycle: Enter New Parent ---
            if (newParentNode) {
                const behavior = behaviorRegistry.getByType(newParentNode.type as NodeType);
                if (behavior.onChildAdd) {
                    // Note: pass 'node' (current state). The patch above hasn't applied yet.
                    // The hook might overwrite position/draggable/etc.
                    const enterPatches = behavior.onChildAdd(newParentNode, node, context);
                    enterPatches.forEach(p => pendingPatches.push(p));
                }
            }
        });

        // 3. Apply All Updates
        if (pendingPatches.length > 0) {
            // We need to merge patches for the same ID to ensure consistency
            // e.g. Transform sets 'position', onChildAdd also sets 'position' (e.g. Rack) -> onChildAdd should win (it's last in the loop)
            this.updateNodes(pendingPatches);
        }

        // 4. Fix Layout
        // We need to fetch FRESH nodes because updateNodes updated the store
        const freshNodes = this.state.nodes;
        const fixedNodes = this.layout.fixGlobalLayout(freshNodes) as SynniaNode[];

        // Ensure topological order (Parent before Child)
        this.setNodes(sortNodesTopologically(fixedNodes));
    }

    /**
     * Deletes multiple nodes and their connected edges.
     * Also triggers a layout fix for correctness.
     */
    public deleteNodes(nodeIds: string[]) {
        if (nodeIds.length === 0) return;
        const { nodes, edges } = this.state;
        const idsToDelete = new Set(nodeIds);

        // 0. Lifecycle: onDelete
        // We should trigger onDelete for each node to allow cleanup
        // (Not implemented fully yet, but placeholder is here)
        /*
        nodeIds.forEach(id => {
            const node = nodes.find(n => n.id === id);
            if (node) {
                const behavior = behaviorRegistry.getByType(node.type as NodeType);
                behavior.onDelete?.(node, context);
            }
        });
        */

        // 1. Clean up edges first (find edges connected to ANY of the deleted nodes)
        // Note: We can filter edges directly, it's faster than getConnectedEdges loop for batch
        const remainingEdges = edges.filter(e => !idsToDelete.has(e.source) && !idsToDelete.has(e.target));

        // 2. Remove nodes
        const remainingNodes = nodes.filter(n => !idsToDelete.has(n.id));

        // 3. Trigger Global Layout Fix (in case we deleted children or parent containers)
        // This is important for Racks to resize if content is removed.
        const fixedNodes = this.layout.fixGlobalLayout(remainingNodes) as SynniaNode[];

        this.setNodes(fixedNodes);
        this.setEdges(remainingEdges);
    }

    // =========================================================================
    // Selection Primitives
    // =========================================================================

    public selectNodes(ids: string[], mode: 'replace' | 'append' | 'toggle' = 'replace') {
        const idSet = new Set(ids);

        const nodes = this.state.nodes.map(n => {
            const isTarget = idSet.has(n.id);
            let selected = n.selected;

            if (mode === 'replace') {
                selected = isTarget;
            } else if (mode === 'append') {
                if (isTarget) selected = true;
            } else if (mode === 'toggle') {
                if (isTarget) selected = !selected;
            }

            // Optimization: Only return new object if changed
            if (selected !== n.selected) {
                return { ...n, selected };
            }
            return n;
        });

        this.setNodes(nodes);
    }

    public deselectAll() {
        // Optimization: Check if any are selected first? 
        // Or just map. Map is fast enough for < 1000 nodes.
        const nodes = this.state.nodes.map(n => {
            if (n.selected) return { ...n, selected: false };
            return n;
        });
        this.setNodes(nodes);
    }

    // =========================================================================
    // Topology Primitives (Using xyflow helpers)
    // =========================================================================

    /**
     * Create a connection between nodes.
     * Uses React Flow's `addEdge` to handle duplicates and validation.
     */
    public connect(params: Connection | Edge) {
        const { edges } = this.state;
        const newEdges = addEdge(params, edges);
        this.setEdges(newEdges);
    }

    /**
     * Create an Output Edge (recipe product relationship).
     * This edge type uses 'output' visual style and represents a product relationship.
     */
    public connectOutputEdge(params: Connection) {
        const { edges } = this.state;
        const outputEdge: SynniaEdge = {
            id: `${params.source}-${params.sourceHandle || 'product'}-${params.target}-${params.targetHandle || 'input'}`,
            source: params.source,
            sourceHandle: params.sourceHandle || 'product',
            target: params.target,
            targetHandle: params.targetHandle || 'input',
            type: 'output',  // Use OutputEdge component
            data: { edgeType: 'output' as const }
        };
        this.setEdges([...edges, outputEdge]);
    }

    /**
     * Disconnects a specific edge.
     */
    public disconnect(edgeId: string) {
        const edges = this.state.edges.filter(e => e.id !== edgeId);
        this.setEdges(edges);
    }

    /**
     * Removes all edges connected to a specific node.
     * Useful before deleting a node.
     */
    public cleanNodeEdges(nodeId: string) {
        const { nodes, edges } = this.state;
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;

        // Use xyflow helper to find connected edges
        // Note: getConnectedEdges expects a LIST of nodes, and returns edges connected to ANY of them.
        const connectedEdges = getConnectedEdges([node], edges);
        const connectedIds = new Set(connectedEdges.map(e => e.id));

        if (connectedIds.size > 0) {
            const remainingEdges = edges.filter(e => !connectedIds.has(e.id));
            this.setEdges(remainingEdges);
        }
    }

    /**
     * Helper to get edges connected to a node (without deleting them).
     */
    public getConnectedEdges(nodeId: string): Edge[] {
        const { nodes, edges } = this.state;
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return [];
        return getConnectedEdges([node], edges);
    }

    // =========================================================================
    // State & Locks
    // =========================================================================

    public lockNode(id: string, locked: boolean) {
        this.updateNode(id, {
            draggable: !locked,
            selectable: !locked,
            // connectable? React Flow handles `connectable` on Handle component usually,
            // but Node prop can also control it.
            connectable: !locked,
            data: { ...this.state.nodes.find(n => n.id === id)?.data, locked }
        });
    }

    public setNodeVisibility(id: string, visible: boolean) {
        this.updateNode(id, { hidden: !visible });
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    /**
     * Helper: Recursively calculates absolute position.
     */
    public getNodeAbsolutePosition(nodeId: string, nodes: SynniaNode[]): { x: number, y: number } | null {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return null;

        let x = node.position.x;
        let y = node.position.y;
        let currentParentId = node.parentId;

        while (currentParentId) {
            const parent = nodes.find(n => n.id === currentParentId);
            if (!parent) break;

            x += parent.position.x;
            y += parent.position.y;
            currentParentId = parent.parentId;
        }

        return { x, y };
    }
}

// Singleton Instance
export const graphEngine = new GraphEngine();