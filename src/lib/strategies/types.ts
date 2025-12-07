import { SynniaNode } from '@/types/project';

export interface DragResult {
    updatedNodes: SynniaNode[];
    handled: boolean;
}

export interface LayoutStrategy {
    /**
     * Called when a node is dropped onto a container managed by this strategy.
     * Returns the updated node list and a success flag.
     */
    onDrop(
        allNodes: SynniaNode[], 
        draggedNode: SynniaNode, 
        targetContainer: SynniaNode
    ): DragResult;
}
