// Port Registry
// Central registry for all node port definitions

import { NodeType } from '@/types/project';
import type { SynniaNode } from '@/types/project';
import type { Asset } from '@/types/assets';
import type { PortDefinition, NodePortConfig } from './types';

// ============================================================================
// Port Registry Class
// ============================================================================

class PortRegistry {
    /** Static port configs by node type */
    private configs = new Map<NodeType | string, NodePortConfig>();

    /**
     * Register port configuration for a node type
     */
    register(nodeType: NodeType | string, config: NodePortConfig): void {
        this.configs.set(nodeType, config);
    }

    /**
     * Get all output ports for a node
     */
    getOutputPorts(node: SynniaNode, asset: Asset | null): PortDefinition[] {
        // Try exact match first, then fallback to base type for virtual types (e.g., recipe:xxx -> recipe)
        let config = this.configs.get(node.type);
        if (!config && node.type.includes(':')) {
            const baseType = node.type.split(':')[0];
            config = this.configs.get(baseType);
        }
        if (!config) return [];

        const outputs: PortDefinition[] = [];

        // Add static output ports
        if (config.static) {
            outputs.push(...config.static.filter(p => p.direction === 'output'));
        }

        // Add dynamic output ports
        if (config.dynamic) {
            outputs.push(...config.dynamic(node, asset).filter(p => p.direction === 'output'));
        }

        return outputs;
    }

    /**
     * Get all input ports for a node
     */
    getInputPorts(node: SynniaNode, asset: Asset | null): PortDefinition[] {
        // Try exact match first, then fallback to base type for virtual types
        let config = this.configs.get(node.type);
        if (!config && node.type.includes(':')) {
            const baseType = node.type.split(':')[0];
            config = this.configs.get(baseType);
        }
        if (!config) return [];

        const inputs: PortDefinition[] = [];

        // Add static input ports
        if (config.static) {
            inputs.push(...config.static.filter(p => p.direction === 'input'));
        }

        // Add dynamic input ports
        if (config.dynamic) {
            inputs.push(...config.dynamic(node, asset).filter(p => p.direction === 'input'));
        }

        return inputs;
    }

    /**
     * Get a specific port by ID
     */
    getPort(
        node: SynniaNode,
        asset: Asset | null,
        portId: string
    ): PortDefinition | undefined {
        const allPorts = [
            ...this.getOutputPorts(node, asset),
            ...this.getInputPorts(node, asset),
        ];
        return allPorts.find(p => p.id === portId);
    }

    /**
     * Check if a node type has been registered
     */
    hasConfig(nodeType: NodeType | string): boolean {
        return this.configs.has(nodeType);
    }

    /**
     * Get all registered node types
     */
    getRegisteredTypes(): (NodeType | string)[] {
        return Array.from(this.configs.keys());
    }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const portRegistry = new PortRegistry();
