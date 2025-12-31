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
    getNodes: () => SynniaNode[];
    getNode: (id: string) => SynniaNode | undefined;
}

/**
 * The "Soul" of a Node.
 * Defines how a node behaves in terms of lifecycle and interaction.
 * 
 * All methods should be PURE (no side effects on global state) and return Patches.
 */
export interface NodeBehavior {
    /** 
     * Called when a node is first created.
     * Use this to set initial data, apply default styles, or create backing assets.
     */
    onCreate?: (node: SynniaNode, context: EngineContext) => NodePatch[];

    /** 
     * Called before a node is deleted.
     * Use this to clean up resources.
     */
    onDelete?: (node: SynniaNode, context: EngineContext) => void;

    /**
     * Called when the user toggles the collapse state.
     */
    onCollapse?: (node: SynniaNode, isCollapsed: boolean, context: EngineContext) => NodePatch[];
}

