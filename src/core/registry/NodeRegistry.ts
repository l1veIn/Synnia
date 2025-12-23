import { NodeProps, XYPosition } from '@xyflow/react';
import { LucideIcon } from 'lucide-react';
import type { NodeBehavior } from '@core/engine/types/behavior';
import type { NodePortConfig } from '@core/engine/ports/types';
import type { SynniaNode, BaseNodeData, NodeType } from '@/types/project';
import type { Asset, FieldDefinition } from '@/types/assets';
import type { GraphEngine } from '@core/engine/GraphEngine';
import type { ExecutionResult } from '@/types/recipe';

// ============================================================================
// Node Meta - Static metadata for a node type
// ============================================================================

export type NodeCategory = 'Asset' | 'Process' | 'Utility' | 'Container' | 'Recipe';

export interface NodeMeta {
    title: string;
    icon: LucideIcon;
    category: NodeCategory;
    description?: string;
    hidden?: boolean;
    alias?: string;
    style?: {
        width?: number;
        height?: number;
        minWidth?: number;
        minHeight?: number;
    };
    fileImport?: {
        accept: string;
        label?: string;
        assetType: 'image' | 'video' | 'audio' | 'pdf' | 'file';
    };
}

// ============================================================================
// Node Capabilities
// ============================================================================

export interface NodeCaps {
    collapsible?: boolean;
    dockable?: boolean;
    isCollection?: boolean;
}

// ============================================================================
// Hook Context
// ============================================================================

export interface HookContext {
    node: SynniaNode;
    asset: Asset | undefined;
    engine: GraphEngine;
}

// ============================================================================
// Context Menu
// ============================================================================

export interface ContextMenuItem {
    id: string;
    label: string;
    icon?: LucideIcon;
    shortcut?: string;
    danger?: boolean;
    separator?: boolean;
}

// ============================================================================
// Node Spec
// ============================================================================

export interface NodeSpec {
    type: NodeType | string;
    data: Partial<BaseNodeData>;
    asset?: Partial<Asset>;
    position?: 'below' | 'right' | XYPosition;
    dockedTo?: string | '$prev';
}

// ============================================================================
// Create Context & Result
// ============================================================================

export interface CreateContext {
    data?: any;                    // Executor output (undefined for user creation)
    schema?: FieldDefinition[];    // Schema from YAML (for Form nodes)
}

export interface CreateResult {
    data?: Partial<BaseNodeData>;  // UI config
    asset?: Partial<Asset>;        // Asset
}

// ============================================================================
// Node Hooks (optional extension points)
// ============================================================================

export interface NodeHooks {
    onDoubleClick?: (ctx: HookContext, fitView: (options?: any) => void) => void;
    getContextMenu?: (ctx: HookContext) => ContextMenuItem[];
    onContextMenuAction?: (ctx: HookContext, actionId: string) => void;
    canDockWith?: (ctx: HookContext, target: SynniaNode, targetAsset: Asset | undefined) => boolean;
    onRun?: (ctx: HookContext) => Promise<ExecutionResult>;
    getItems?: (asset: Asset) => any[];
    mergeItems?: (existing: any[], incoming: any[]) => any[];
}

// ============================================================================
// Node Definition - New unified interface
// ============================================================================

export interface NodeDefinition {
    type: string;
    component: React.FC<NodeProps<any>>;
    inspector?: React.FC<any>;
    meta: NodeMeta;
    capabilities?: NodeCaps;

    // Core factory method - constructs initial asset + UI config
    create: (ctx: CreateContext) => CreateResult;

    // Optional hooks for extension
    hooks?: NodeHooks;
    ports?: NodePortConfig;
    behavior?: NodeBehavior;
}

// ============================================================================
// Node Registry
// ============================================================================

class NodeRegistry {
    private nodes = new Map<string, NodeDefinition>();
    private aliasMap = new Map<string, string>();

    register(definition: NodeDefinition): void {
        this.nodes.set(definition.type, definition);
        if (definition.meta.alias) {
            this.aliasMap.set(definition.meta.alias, definition.type);
        }
    }

    has(type: string): boolean {
        return this.nodes.has(type);
    }

    get(type: string): NodeDefinition | undefined {
        return this.nodes.get(type);
    }

    getByAlias(alias: string): NodeDefinition | undefined {
        const type = this.aliasMap.get(alias);
        return type ? this.nodes.get(type) : undefined;
    }

    getMeta(type: string): NodeMeta | undefined {
        return this.nodes.get(type)?.meta;
    }

    getDefinition(type: string): NodeDefinition | undefined {
        return this.nodes.get(type);
    }

    getPorts(type: string): NodePortConfig | undefined {
        return this.nodes.get(type)?.ports;
    }

    getAllTypes(): string[] {
        return Array.from(this.nodes.keys());
    }

    isCollection(type: string): boolean {
        return this.nodes.get(type)?.capabilities?.isCollection ?? false;
    }

    isDockable(type: string): boolean {
        return this.nodes.get(type)?.capabilities?.dockable ?? false;
    }

    getHookContext(nodeId: string, engine: GraphEngine): HookContext | undefined {
        const node = engine.state.nodes.find(n => n.id === nodeId);
        if (!node) return undefined;
        const assetId = node.data.assetId as string | undefined;
        const asset = assetId ? engine.state.assets[assetId] : undefined;
        return { node, asset, engine };
    }

    getNodeTypes(): Record<string, any> {
        const result: Record<string, any> = {};
        for (const [type, def] of this.nodes) {
            result[type] = def.component;
        }
        return result;
    }

    getInspectorTypes(): Record<string, React.FC<any>> {
        const result: Record<string, React.FC<any>> = {};
        for (const [type, def] of this.nodes) {
            if (def.inspector) {
                result[type] = def.inspector;
            }
        }
        return result;
    }

    getAllMetas(): Record<string, NodeMeta> {
        const result: Record<string, NodeMeta> = {};
        for (const [type, def] of this.nodes) {
            result[type] = def.meta;
        }
        return result;
    }
}

export const nodeRegistry = new NodeRegistry();
