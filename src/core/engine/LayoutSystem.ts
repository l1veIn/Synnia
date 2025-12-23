import { GraphEngine } from './GraphEngine';
import { SynniaNode, NodeType } from '@/types/project';
import { behaviorRegistry } from '@core/engine/BehaviorRegistry';
import { NodePatch, EngineContext } from '@core/engine/types/behavior';

export class LayoutSystem {
    private engine: GraphEngine;

    constructor(engine: GraphEngine) {
        this.engine = engine;
    }

    /**
     * Toggles a Group's collapse state using its defined Behavior.
     */
    public toggleGroupCollapse(groupId: string) {
        const { nodes } = this.engine.state;
        const group = nodes.find(n => n.id === groupId);
        if (!group) return;

        const isCollapsed = !group.data.collapsed;

        // 1. Get Behavior
        const behavior = behaviorRegistry.getByType(group.type as NodeType);
        let currentNodes = [...nodes];

        // 2. Apply onCollapse hook if exists
        if (behavior.onCollapse) {
            const context = this.createContext(currentNodes);
            const patches = behavior.onCollapse(group, isCollapsed, context);
            currentNodes = this.applyPatches(currentNodes, patches);
        } else {
            // Default behavior: just toggle the data flag
            currentNodes = currentNodes.map(n => n.id === groupId ? { ...n, data: { ...n.data, collapsed: isCollapsed } } : n);
        }

        // 3. Fix Global Layout (Handle nested resizing)
        currentNodes = this.fixGlobalLayout(currentNodes);

        this.engine.setNodes(currentNodes);
    }

    /**
     * Simple auto-layout trigger for a group; currently reuses the global layout pass.
     */
    public autoLayoutGroup(_groupId: string) {
        const nodes = this.fixGlobalLayout(this.engine.state.nodes);
        this.engine.setNodes(nodes);
    }

    /**
     * Toggles an individual node's collapse state (e.g. Asset Node), triggering a Rack reflow.
     * Now delegates to the node's Behavior (e.g. StandardAssetBehavior) for logic.
     */
    public toggleNodeCollapse(nodeId: string) {
        const { nodes } = this.engine.state;
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;

        const isCollapsed = !node.data.collapsed;

        // 1. Get Behavior
        const behavior = behaviorRegistry.getByType(node.type as NodeType);

        let updatedNodes = [...nodes];

        // 2. Delegate to Behavior
        if (behavior.onCollapse) {
            const context = this.createContext(updatedNodes);
            const patches = behavior.onCollapse(node, isCollapsed, context);
            updatedNodes = this.applyPatches(updatedNodes, patches);
        } else {
            // Default Fallback: Just toggle the flag
            updatedNodes = updatedNodes.map(n => n.id === nodeId ? {
                ...n,
                data: { ...n.data, collapsed: isCollapsed }
            } : n);
        }

        // 3. Trigger reflow of parents
        updatedNodes = this.fixGlobalLayout(updatedNodes);

        this.engine.setNodes(updatedNodes);
    }

    /**
     * Recursively updates layout for all Containers using their Behaviors.
     * Uses a Bottom-Up approach to ensure inner containers resize before outer ones.
     */
    public fixGlobalLayout(nodes: SynniaNode[]): SynniaNode[] {
        // 1. Build a Map for fast access/updates (Simulation State)
        const nodeMap = new Map(nodes.map(n => [n.id, n]));

        // 2. Helper to get depth (cacheable if needed, but tree is small enough usually)
        const getDepth = (node: SynniaNode): number => {
            let depth = 0;
            let current = node;
            while (current.parentId && nodeMap.has(current.parentId)) {
                depth++;
                current = nodeMap.get(current.parentId)!;
            }
            return depth;
        };

        // 3. Sort nodes by depth (Deepest first)
        // We only care about nodes that have children, but iterating all is safe if behavior.onLayout is checked
        const sortedNodes = [...nodes].sort((a, b) => getDepth(b) - getDepth(a));

        // 4. Bubble Up
        for (const container of sortedNodes) {
            const behavior = behaviorRegistry.getByType(container.type as NodeType);

            // If this node has a layout behavior
            if (behavior.onLayout) {
                // Get *current* children from the simulation state (they might have been updated by their own layout step)
                const currentChildren = Array.from(nodeMap.values()).filter(n => n.parentId === container.id);

                // Create context based on current simulation
                const context: EngineContext = {
                    getNodes: () => Array.from(nodeMap.values()),
                    getNode: (id) => nodeMap.get(id)
                };

                // Calculate Layout
                const patches = behavior.onLayout(container, currentChildren, context);

                // Apply updates to the simulation map
                patches.forEach(p => {
                    const target = nodeMap.get(p.id);
                    if (target) {
                        nodeMap.set(p.id, this.mergeNode(target, p.patch));
                    }
                });
            }
        }

        const laidOutNodes = Array.from(nodeMap.values());
        return this.fixDockingLayout(laidOutNodes);
    }

    /**
     * Applies sticky constraints (Docking) after container layouts are settled.
     * Logic: Top-Down propagation from Master to Followers.
     */
    public fixDockingLayout(nodes: SynniaNode[]): SynniaNode[] {
        const nodeMap = new Map(nodes.map(n => [n.id, n]));
        const followerMap = new Map<string, string[]>(); // Master -> Followers

        // 1. Build Dependency Graph & Reset Master Flags
        // We need to reset hasDockedFollower to false first, then set it to true if confirmed.
        // But since we are iterating, we can't mutate 'nodes' directly if we want to be pure-ish.
        // Actually, nodeMap contains the working copies. Let's clean them first?
        // Or better: clean on the fly? No, we might have lost a follower, so we need to reset.

        for (const node of nodeMap.values()) {
            if (node.data.hasDockedFollower) {
                nodeMap.set(node.id, {
                    ...node,
                    data: { ...node.data, hasDockedFollower: false }
                });
            }
        }

        // Re-build map after reset (or just iterate nodes again)
        // Optimization: Single pass? 
        // We can just iterate nodes to build followerMap.

        nodes.forEach(node => {
            const masterId = node.data.dockedTo;
            if (masterId && nodeMap.has(masterId)) {
                if (!followerMap.has(masterId)) {
                    followerMap.set(masterId, []);
                }
                followerMap.get(masterId)!.push(node.id);
            }
        });

        if (followerMap.size === 0) return Array.from(nodeMap.values()); // Return clean state

        // 2. Recursive Update Function
        const visited = new Set<string>();

        const updateFollowers = (masterId: string, recursionStack: Set<string>) => {
            if (recursionStack.has(masterId)) return;
            recursionStack.add(masterId);

            const followers = followerMap.get(masterId);
            if (!followers) return;

            let master = nodeMap.get(masterId)!;

            // Mark Master as having a follower (for styling)
            // Only update if not already true to avoid object churn?
            if (!master.data.hasDockedFollower) {
                master = {
                    ...master,
                    data: { ...master.data, hasDockedFollower: true }
                };
                nodeMap.set(masterId, master);
            }

            // Determine Master's visual dimensions
            // For collapsed nodes: prefer measured.height (actual rendered height)
            // Fallback to 40px (header height) if not yet measured
            let masterH: number;
            if (master.data.collapsed) {
                // Use measured height if available (includes handle fields when collapsed)
                masterH = master.measured?.height ?? 40;
            } else {
                masterH = (master.style?.height as number) ?? master.measured?.height ?? master.height ?? 100;
            }

            const masterW = (master.style?.width as number) ?? master.measured?.width ?? master.width ?? 200;
            const masterX = master.position.x;
            const masterY = master.position.y;

            followers.forEach(followerId => {
                const follower = nodeMap.get(followerId)!;

                // Constraint: Must be siblings
                if (follower.parentId !== master.parentId) return;

                const GAP = 0; // Tightly packed

                const newY = masterY + masterH + GAP;
                const newX = masterX;
                const newW = masterW;

                // Update Follower
                const updatedFollower = {
                    ...follower,
                    position: { ...follower.position, x: newX, y: newY },
                    style: { ...follower.style, width: newW },
                    width: newW,
                    // If follower was collapsed, we might need to handle its height too? 
                    // No, follower height is its own business (or determined by ITS children).
                };

                nodeMap.set(followerId, updatedFollower as SynniaNode);

                // Recursively update this follower's followers
                updateFollowers(followerId, new Set(recursionStack));
            });
        };

        // 3. Trigger from Top-Level Masters
        // A Top-Level Master is one that is NOT docked to anyone (or docked to missing node)
        const allMasters = Array.from(followerMap.keys());
        const topLevelMasters = allMasters.filter(id => {
            const node = nodeMap.get(id);
            return !node?.data.dockedTo || !nodeMap.has(node.data.dockedTo!);
        });

        // If there are cycles (A->B->A) without any root, topLevelMasters is empty.
        // We should handle that edge case by iterating remaining unvisited masters?
        // For now, assume user creates DAGs.

        topLevelMasters.forEach(id => updateFollowers(id, new Set()));

        return Array.from(nodeMap.values());
    }

    // --- Helpers ---

    private createContext(nodes: SynniaNode[]): EngineContext {
        return {
            getNodes: () => nodes,
            getNode: (id) => nodes.find(n => n.id === id)
        };
    }

    private applyPatches(nodes: SynniaNode[], patches: NodePatch[]): SynniaNode[] {
        const patchMap = new Map(patches.map(p => [p.id, p.patch]));
        return nodes.map(n => {
            const patch = patchMap.get(n.id);
            if (patch) {
                return this.mergeNode(n, patch);
            }
            return n;
        });
    }

    private mergeNode(original: SynniaNode, patch: Partial<SynniaNode>): SynniaNode {
        return {
            ...original,
            ...patch,
            style: { ...original.style, ...patch.style },
            data: { ...original.data, ...patch.data }
        } as SynniaNode;
    }
}
