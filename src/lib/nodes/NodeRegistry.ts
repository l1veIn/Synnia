import { NodeProps } from '@xyflow/react';
import { NodeConfig } from '@/types/node-config';
import type { NodeBehavior } from '@/lib/engine/types/behavior';
import type { NodePortConfig } from '@/lib/engine/ports/types';

// ============================================================================
// Asset Content Schema - DEPRECATED
// Asset now self-describes via valueType + config
// ============================================================================

/** @deprecated Asset now self-describes via valueType + config */
export interface FieldSchema {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'enum';
    description?: string;
    default?: any;
    options?: string[];
    itemType?: string;
    required?: boolean;
}

/** @deprecated Asset now self-describes via valueType + config */
export type AssetContentSchema = Record<string, FieldSchema>;

// ============================================================================
// Node Definition - complete definition of a node type
// ============================================================================

export interface NodeDefinition {
    /** Node type identifier (e.g., NodeType.SELECTOR or 'recipe:xxx') */
    type: string;

    /** React component for rendering the node on canvas */
    component: React.FC<NodeProps<any>>;

    /** Optional inspector component for the property panel */
    inspector?: React.FC<any>;

    /** Node configuration (metadata, factories, etc.) */
    config: NodeConfig;

    /** Optional behavior for asset-based nodes */
    behavior?: NodeBehavior;

    /** Optional port configuration */
    ports?: NodePortConfig;

    /** 
     * @deprecated Asset now self-describes via valueType + config.
     * Schema describing the AssetContent structure.
     */
    assetContentSchema?: AssetContentSchema;
}

// ============================================================================
// Generated Documentation Types
// ============================================================================

export interface NodeConfigDoc {
    type: string;
    alias?: string;
    title: string;
    description?: string;
    category: string;
    compatibleValueTypes?: string[];
}

// ============================================================================
// Node Registry - unified management of all node types
// ============================================================================

class NodeRegistry {
    private nodes = new Map<string, NodeDefinition>();
    private aliasMap = new Map<string, string>(); // alias -> type

    /**
     * Register a node definition
     */
    register(definition: NodeDefinition): void {
        const { type, config } = definition;

        this.nodes.set(type, definition);

        // Register alias if present
        if (config.createNodeAlias) {
            this.aliasMap.set(config.createNodeAlias, type);
        }
    }

    /**
     * Check if a node type is registered
     */
    has(type: string): boolean {
        return this.nodes.has(type);
    }

    /**
     * Get ports for a node type
     */
    getPorts(type: string): NodePortConfig | undefined {
        return this.nodes.get(type)?.ports;
    }

    /**
     * Get node definition by type
     */
    get(type: string): NodeDefinition | undefined {
        return this.nodes.get(type);
    }

    /**
     * Get node definition by createNodeAlias
     */
    getByAlias(alias: string): NodeDefinition | undefined {
        const type = this.aliasMap.get(alias);
        return type ? this.nodes.get(type) : undefined;
    }

    /**
     * Get node config by type
     */
    getConfig(type: string): NodeConfig | undefined {
        return this.nodes.get(type)?.config;
    }

    /**
     * Get all registered node types
     */
    getAllTypes(): string[] {
        return Array.from(this.nodes.keys());
    }

    /**
     * Export nodeTypes for ReactFlow
     */
    getNodeTypes(): Record<string, any> {
        const result: Record<string, any> = {};
        for (const [type, def] of this.nodes) {
            result[type] = def.component;
        }
        return result;
    }

    /**
     * Export inspectorTypes
     */
    getInspectorTypes(): Record<string, React.FC<any>> {
        const result: Record<string, React.FC<any>> = {};
        for (const [type, def] of this.nodes) {
            if (def.inspector) {
                result[type] = def.inspector;
            }
        }
        return result;
    }

    /**
     * Export all configs (for compatibility with existing code)
     */
    getAllConfigs(): Record<string, NodeConfig> {
        const result: Record<string, NodeConfig> = {};
        for (const [type, def] of this.nodes) {
            result[type] = def.config;
        }
        return result;
    }

    /**
     * Generate documentation for all nodes
     */
    generateConfigDocs(): NodeConfigDoc[] {
        const docs: NodeConfigDoc[] = [];

        for (const [type, def] of this.nodes) {
            const { config } = def;

            // Skip hidden nodes and recipe nodes
            if (config.hidden || type.startsWith('recipe:')) continue;

            docs.push({
                type,
                alias: config.createNodeAlias,
                title: config.title,
                description: config.description,
                category: config.category,
                compatibleValueTypes: config.compatibleValueTypes,
            });
        }

        return docs;
    }
}

// Singleton instance
export const nodeRegistry = new NodeRegistry();
