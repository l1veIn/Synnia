import { SynniaNode, SynniaEdge } from '@/types/project';
import type { Asset } from '@/types/assets';
import type { PortValue } from '@core/engine/ports/types';

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
 * Context for connection lifecycle hooks (extends EngineContext).
 * Provides access to source/target nodes, assets, and the edge being created/removed.
 * sourcePortValue is pre-resolved by the engine - target nodes don't need to resolve it themselves.
 */
export interface ConnectionContext extends EngineContext {
    sourceNode: SynniaNode;
    targetNode: SynniaNode;
    edge: SynniaEdge;
    sourceAsset: Asset | null;
    targetAsset: Asset | null;
    /** Pre-resolved output value from source port (via behavior.resolveOutput) */
    sourcePortValue: PortValue | null;
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

    // ========================================================================
    // IoC Hooks for Port Resolution (Phase 1 of Engine Port Refactoring)
    // ========================================================================

    /**
     * Resolve the output value for a specific port.
     * Called by PortResolver - nodes define how to expose their data.
     * Return null to fall through to default resolution.
     */
    resolveOutput?: (
        node: SynniaNode,
        asset: Asset | null,
        portId: string
    ) => PortValue | null;

    /**
     * Validate if this node can accept an incoming connection (as target).
     * Called BEFORE the edge is created.
     * Return null to allow, or an error message string to reject.
     */
    canConnect?: (ctx: ConnectionContext) => string | null;

    /**
     * Handle a new connection to this node (as target).
     * Opportunity to auto-fill target fields based on source data.
     * Return an object of field updates to apply to the target asset, or null.
     */
    onConnect?: (ctx: ConnectionContext) => Record<string, any> | null;

    /**
     * Handle disconnection from this node (as target).
     * Opportunity to clear or reset linked fields.
     * Return an object of field updates to apply to the target asset, or null.
     */
    onDisconnect?: (ctx: ConnectionContext) => Record<string, any> | null;
}

