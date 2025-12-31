import { useWorkflowStore, WorkflowState } from '@/store/workflowStore';
import { LayoutSystem } from './LayoutSystem';
import { InteractionSystem } from './InteractionSystem';
import { GraphMutator } from './GraphMutator';
import { AssetSystem } from './AssetSystem';
import { SynniaNode, SynniaEdge, NodeType } from '@/types/project';
import { addEdge, getConnectedEdges, Connection, Edge } from '@xyflow/react';
import { behaviorRegistry } from '@core/engine/BehaviorRegistry';
import { EngineContext, NodePatch } from '@core/engine/types/behavior';
import { sortNodesTopologically } from '@core/utils/graph';

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
    public setNodes(nodes: SynniaNode[]) {
        useWorkflowStore.setState({ nodes });
    }

    public setEdges(edges: SynniaEdge[]) {
        useWorkflowStore.setState({ edges });
    }

    // =========================================================================
    // INSTRUCTION SET (PRIMITIVES) - MEMO
    // =========================================================================

    // --- 1. Selection & Focus ---
    // [DONE] selectNodes: Batch selection control.
    // [DONE] deselectAll: Global cleanup.

    // --- 2. Topology (Edges) ---
    // [DONE] connect: Safe edge creation using xyflow helper.
    // [DONE] disconnect: Remove specific edge.
    // [DONE] cleanNodeEdges: Cascade delete edges for a node.

    // --- 3. State & Locks ---
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

        // Optimization: Only trigger layout if geometry changed
        const affectsLayout =
            patch.position !== undefined ||
            patch.width !== undefined ||
            patch.height !== undefined ||
            patch.measured !== undefined ||
            patch.style !== undefined ||
            (patch.data && (
                'collapsed' in patch.data ||
                'dockedTo' in patch.data ||
                'hasDockedFollower' in patch.data
            ));

        if (affectsLayout) {
            nodes = this.layout.fixGlobalLayout(nodes);
        }

        this.setNodes(nodes);
    }

    /**
     * Batch update multiple nodes at once.
     * Merges multiple patches for the same node ID sequentially.
     */
    public updateNodes(updates: { id: string, patch: Partial<SynniaNode> }[]) {
        const updateMap = new Map<string, Partial<SynniaNode>>();
        let shouldFixLayout = false;

        for (const u of updates) {
            const existing = updateMap.get(u.id) || {};

            // Check if this specific update affects layout
            if (!shouldFixLayout) {
                shouldFixLayout = Boolean(
                    u.patch.position !== undefined ||
                    u.patch.width !== undefined ||
                    u.patch.height !== undefined ||
                    u.patch.measured !== undefined ||
                    u.patch.style !== undefined ||
                    (u.patch.data && (
                        'collapsed' in u.patch.data ||
                        'dockedTo' in u.patch.data ||
                        'hasDockedFollower' in u.patch.data
                    )));
            }

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

        if (shouldFixLayout) {
            nodes = this.layout.fixGlobalLayout(nodes);
        }

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