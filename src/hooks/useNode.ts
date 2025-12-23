import { useMemo, useCallback } from 'react';
import { useWorkflowStore } from '@/store/workflowStore';
import { graphEngine } from '@core/engine/GraphEngine';
import { BaseNodeData, SynniaNode } from '@/types/project';
import { Asset } from '@/types/assets';
import { cn } from '@/lib/utils';

/**
 * useNode - Core Hook for Node Components (Deep Module)
 * 
 * Responsibilities:
 * - Derive view state from raw node data
 * - Provide pre-computed classNames
 * - Expose action methods that call GraphEngine
 * - Hide implementation details from Node components
 */

export interface NodeState {
    // Identity
    node: SynniaNode | undefined;
    asset: Asset | undefined;

    // Derived UI State
    title: string;
    isCollapsed: boolean;
    isResizable: boolean;
    isDockedTop: boolean;
    isDockedBottom: boolean;
    isReference: boolean;
    executionState: string;

    // Output Edge
    hasProductHandle: boolean;

    // Pre-computed Styles
    shellClassName: string;
    headerClassName: string;
}

export interface NodeActions {
    collapse: () => void;
    expand: (targetHeight?: number) => void;
    toggle: () => void;
    resize: (width: number, height: number) => void;
    remove: () => void;
    updateContent: (content: any) => void;
    updateTitle: (title: string) => void;
    updateData: (data: Partial<BaseNodeData>) => void;
}

export interface UseNodeReturn {
    state: NodeState;
    actions: NodeActions;
}

/**
 * Derive view state from raw node data.
 * Centralizes all the scattered state reading logic.
 */
function deriveViewState(node: SynniaNode | undefined): Omit<NodeState, 'node' | 'asset' | 'shellClassName' | 'headerClassName'> {
    if (!node) {
        return {
            title: 'Unknown',
            isCollapsed: false,
            isResizable: true,
            isDockedTop: false,
            isDockedBottom: false,
            isReference: false,
            executionState: 'idle',
            hasProductHandle: false,
        };
    }

    const data = node.data;
    const other = data.other as { enableResize?: boolean; expandedHeight?: number } | undefined;

    return {
        title: data.title || 'Untitled',
        isCollapsed: !!data.collapsed,
        isResizable: other?.enableResize !== false && !data.collapsed,
        isDockedTop: !!data.dockedTo,
        isDockedBottom: !!(data as any).hasDockedFollower,
        isReference: !!data.isReference,
        executionState: data.state || 'idle',
        hasProductHandle: !!data.hasProductHandle,
    };
}

/**
 * Compute shell className based on state.
 */
function computeShellClassName(state: ReturnType<typeof deriveViewState>): string {
    return cn(
        'min-w-[200px]',
        state.isCollapsed ? 'h-auto min-h-0' : 'h-full'
    );
}

/**
 * Compute header className based on state.
 */
function computeHeaderClassName(state: ReturnType<typeof deriveViewState>): string {
    return cn(
        state.isCollapsed && 'border-b-0',
        state.isDockedTop ? 'rounded-t-none' : 'rounded-t-xl',
        state.isCollapsed && (state.isDockedBottom ? 'rounded-b-none' : 'rounded-b-xl')
    );
}

/**
 * The main hook. Returns state and actions for a node.
 */
export function useNode(nodeId: string): UseNodeReturn {
    // --- Read from Store ---
    const node = useWorkflowStore(s => s.nodes.find(n => n.id === nodeId));
    const assetId = node?.data.assetId;
    const asset = useWorkflowStore(s => assetId ? s.assets[assetId] : undefined);

    // --- Derive State ---
    const derivedState = useMemo(() => deriveViewState(node), [node]);

    const state: NodeState = useMemo(() => ({
        node,
        asset,
        ...derivedState,
        shellClassName: computeShellClassName(derivedState),
        headerClassName: computeHeaderClassName(derivedState),
    }), [node, asset, derivedState]);

    // --- Actions ---
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
    const actions: NodeActions = useMemo(() => ({
        collapse: () => {
            if (!node) return;
            const currentHeight = (node.style?.height as number) || node.measured?.height || 200;
            graphEngine.updateNode(nodeId, {
                data: { collapsed: true, other: { ...(node.data.other || {}), expandedHeight: currentHeight } },
                // Use 'auto' to let React Flow measure actual collapsed content height
                style: { height: 'auto' },
                height: undefined,
            });
        },

        expand: (targetHeight?: number) => {
            if (!node) return;
            const other = node.data.other as { expandedHeight?: number } | undefined;
            const height = targetHeight || other?.expandedHeight || 200;
            graphEngine.updateNode(nodeId, {
                data: { collapsed: false },
                style: { height },
                height,
            });
        },

        toggle: () => {
            if (state.isCollapsed) {
                actions.expand();
            } else {
                actions.collapse();
            }
        },

        resize: (width: number, height: number) => {
            graphEngine.updateNode(nodeId, {
                style: { width, height },
                width,
                height,
            });
        },

        remove: () => {
            graphEngine.mutator.removeNode(nodeId);
        },

        updateContent: (content: any) => {
            if (assetId) {
                graphEngine.assets.update(assetId, content);
            }
        },

        updateTitle: (title: string) => {
            graphEngine.updateNode(nodeId, {
                data: { title },
            });
        },

        updateData: (data: Partial<BaseNodeData>) => {
            graphEngine.updateNode(nodeId, { data });
        },
    }), [nodeId, node, assetId, state]);

    return { state, actions };
}

/**
 * Convenience hook to get just the asset for a node.
 * Useful for Inspector panels that only need asset data.
 */
export function useNodeAsset(nodeId: string) {
    const node = useWorkflowStore(s => s.nodes.find(n => n.id === nodeId));
    const assetId = node?.data.assetId;
    const asset = useWorkflowStore(s => assetId ? s.assets[assetId] : undefined);

    const updateContent = useCallback((content: any) => {
        if (assetId) {
            graphEngine.assets.update(assetId, content);
        }
    }, [assetId]);

    const updateSys = useCallback((sys: Partial<Asset['sys']>) => {
        if (assetId) {
            graphEngine.assets.updateSys(assetId, sys);
        }
    }, [assetId]);

    return { asset, updateContent, updateSys };
}
