import { SynniaNode } from '@/types/project';

/**
 * A declarative description of changes to be applied to a node.
 * Returning patches instead of mutating state directly avoids infinite loops and side effects.
 */
export interface NodePatch {
    id: string;
    patch: Partial<SynniaNode>;
}

/**
 * Context provided to lifecycle hooks, giving access to the global graph state.
 */
export interface EngineContext {
    // Access to current graph state (read-only snapshots)
    getNodes: () => SynniaNode[];
    getNode: (id: string) => SynniaNode | undefined;
    
    // Future: Access to Asset System
    // assets: AssetSystem; 
}

/**
 * The "Soul" of a Node.
 * Defines how a node behaves in terms of lifecycle, interaction, and layout.
 * 
 * All methods should be PURE (no side effects on global state) and return Patches.
 */
export interface NodeBehavior {
    // --- 1. Existence (Lifecycle) ---
    
    /** 
     * Called when a node is first created.
     * Use this to set initial data, apply default styles, or create backing assets.
     */
    onCreate?: (node: SynniaNode, context: EngineContext) => NodePatch[];

    /** 
     * Called before a node is deleted.
     * Use this to clean up resources or trigger cascade deletions (return other nodes to delete? 
     * Note: Current Engine might handle deletion logic, but this hook allows "cleanup actions").
     */
    onDelete?: (node: SynniaNode, context: EngineContext) => void;

    // --- 2. Hierarchy & Interaction (Topology) ---

    /**
     * Called when a user drags a potential child over this container.
     * Returns true if the child is accepted, or an object with an error reason.
     */
    validateInsert?: (container: SynniaNode, child: SynniaNode, context: EngineContext) => boolean | { error: string };

    /**
     * Called when a child is successfully dropped into this container.
     * Use this to lock the child's position, update its data, etc.
     */
    onChildAdd?: (container: SynniaNode, child: SynniaNode, context: EngineContext) => NodePatch[];

    /**
     * Called when a child is removed (detached) from this container.
     * Use this to unlock the child, restore original position, etc.
     */
    onChildRemove?: (container: SynniaNode, child: SynniaNode, context: EngineContext) => NodePatch[];

    // --- 3. Layout & Presentation (Visuals) ---

    /**
     * Called when the container's state changes (children added/removed/resized).
     * This is the "Render Loop" for the node's internal layout.
     * It should calculate new positions/sizes for children and the container itself.
     * 
     * @param container The container node itself
     * @param children The current children of the container
     * @param context Engine context
     */
    onLayout?: (container: SynniaNode, children: SynniaNode[], context: EngineContext) => NodePatch[];

    /**
     * Called when the user toggles the collapse state.
     */
    onCollapse?: (container: SynniaNode, isCollapsed: boolean, context: EngineContext) => NodePatch[];
}
