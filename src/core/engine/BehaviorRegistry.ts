import { NodeType } from '@/types/project';
import { NodeBehavior } from './types/behavior';

class BehaviorRegistry {
    private behaviors: Map<string, NodeBehavior> = new Map();

    /**
     * Register a behavior for a specific node type.
     */
    public register(type: string, behavior: NodeBehavior) {
        this.behaviors.set(type, behavior);
    }

    /**
     * Get the behavior for a node type.
     * Handles virtual types (e.g., 'recipe:storyteller' -> 'recipe').
     * Returns a default empty behavior if not found.
     */
    public get(type: string): NodeBehavior {
        // Direct lookup first
        const direct = this.behaviors.get(type);
        if (direct) return direct;

        // Handle virtual types: 'recipe:xxx' -> 'recipe'
        if (type.includes(':')) {
            const baseType = type.split(':')[0];
            const baseBehavior = this.behaviors.get(baseType);
            if (baseBehavior) return baseBehavior;
        }

        return {};
    }

    /**
     * Helper to get behavior from a NodeType enum
     */
    public getByType(type: NodeType): NodeBehavior {
        return this.get(type);
    }
}

export const behaviorRegistry = new BehaviorRegistry();
