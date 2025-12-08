import { useWorkflowStore, WorkflowState } from '@/store/workflowStore';
import { LayoutSystem } from './LayoutSystem';
import { InteractionSystem } from './InteractionSystem';
import { GraphMutator } from './GraphMutator';

export class GraphEngine {
    public layout: LayoutSystem;
    public interaction: InteractionSystem;
    public mutator: GraphMutator;

    constructor() {
        this.layout = new LayoutSystem(this);
        this.interaction = new InteractionSystem(this);
        this.mutator = new GraphMutator(this);
    }

    /**
     * Direct access to the Zustand store state.
     * Warning: This is a snapshot. Do not mutate directly.
     */
    get state(): WorkflowState {
        return useWorkflowStore.getState();
    }

    /**
     * Trigger a state update via the store.
     * This is the only way the Engine modifies the Model.
     */
    public setNodes(nodes: any[]) {
        useWorkflowStore.setState({ nodes });
    }
    
    public setEdges(edges: any[]) {
        useWorkflowStore.setState({ edges });
    }
}

// Singleton Instance
export const graphEngine = new GraphEngine();
