import { SynniaNode, NodeType } from '@/types/project';
import { LayoutStrategy } from './types';
import { FreeGroupStrategy } from './FreeGroupStrategy';
import { RackStrategy } from './RackStrategy';

/**
 * Determines the appropriate layout strategy for a given container node.
 */
export const getContainerStrategy = (container: SynniaNode): LayoutStrategy | null => {
    // 1. Rack Strategy: For RACK nodes OR collapsed Groups
    if (container.type === NodeType.RACK || (container.type === NodeType.GROUP && container.data.collapsed)) {
        return RackStrategy;
    }
    
    // 2. Free Group Strategy: For expanded Groups
    if (container.type === NodeType.GROUP) {
        return FreeGroupStrategy;
    }
    
    // Future extensions:
    // if (container.type === NodeType.GALLERY) return GridStrategy;
    
    return null;
};
