import { LayoutStrategy } from './types';
import { SynniaNode } from '@/types/project';

export const FreeGroupStrategy: LayoutStrategy = {
    onDrop: (nodes, draggedNode, targetGroup) => {
        const updatedNodes = nodes.map(n => {
            if (n.id === draggedNode.id) {
                return {
                    ...n,
                    parentId: targetGroup.id,
                    extent: 'parent',
                    position: {
                        x: draggedNode.position.x - targetGroup.position.x,
                        y: draggedNode.position.y - targetGroup.position.y,
                    }
                } as SynniaNode;
            }
            return n;
        });
        
        return { updatedNodes, handled: true };
    }
};
