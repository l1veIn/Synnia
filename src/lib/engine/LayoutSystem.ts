import { GraphEngine } from './GraphEngine';
import { SynniaNode, NodeType } from '@/types/project';
import { behaviorRegistry } from '@/lib/engine/BehaviorRegistry';
import { NodePatch, EngineContext } from '@/lib/engine/types/behavior';

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
