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
     * Returns a default empty behavior if not found, to avoid null checks.
     */
    public get(type: string): NodeBehavior {
        return this.behaviors.get(type) || {};
    }

    /**
     * Helper to get behavior from a NodeType enum
     */
    public getByType(type: NodeType): NodeBehavior {
        return this.get(type);
    }
}

export const behaviorRegistry = new BehaviorRegistry();
