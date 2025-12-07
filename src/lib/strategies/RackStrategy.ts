import { LayoutStrategy } from './types';
import { insertNodeIntoRack } from '@/lib/rackLayout';

export const RackStrategy: LayoutStrategy = {
    onDrop: (nodes, draggedNode, targetGroup) => {
        // Delegate to the specialized Rack Layout Engine
        const updatedNodes = insertNodeIntoRack(nodes, draggedNode, targetGroup);
        return { updatedNodes, handled: true };
    }
};
