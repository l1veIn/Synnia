import { GraphEngine } from './GraphEngine';
import { 
    fixRackLayout, 
    applyRackCollapse, 
    applyRackExpand,
    applyGroupAutoLayout 
} from '@/lib/rackLayout';
import { SynniaNode } from '@/types/project';

export class LayoutSystem {
    private engine: GraphEngine;

    constructor(engine: GraphEngine) {
        this.engine = engine;
    }

    public toggleGroupCollapse(groupId: string) {
        const { nodes } = this.engine.state;
        const group = nodes.find(n => n.id === groupId);
        if (!group) return;
        
        const isCollapsing = !group.data.collapsed;
        let updatedNodes: SynniaNode[] = [];
        
        if (isCollapsing) {
            updatedNodes = applyRackCollapse(nodes, group);
        } else {
            updatedNodes = applyRackExpand(nodes, group);
        }
        
        // Re-calculate global layout to handle nested rack resizing
        updatedNodes = fixRackLayout(updatedNodes);
        
        this.engine.setNodes(updatedNodes);
    }

    public toggleNodeCollapse(nodeId: string) {
        const { nodes } = this.engine.state;
        let updatedNodes = nodes.map(n => {
            if (n.id === nodeId) {
                const willBeCollapsed = !n.data.collapsed;
                const newStyle = { ...n.style };
                
                // If expanding and height is missing, set a default to prevent layout shrinking
                if (!willBeCollapsed && !newStyle.height) {
                     newStyle.height = 200; 
                }
                
                return { 
                    ...n, 
                    style: newStyle,
                    data: { ...n.data, collapsed: willBeCollapsed } 
                };
            }
            return n;
        }) as SynniaNode[];
        
        updatedNodes = fixRackLayout(updatedNodes);

        this.engine.setNodes(updatedNodes);
    }

    public autoLayoutGroup(groupId: string) {
        const { nodes } = this.engine.state;
        const group = nodes.find(n => n.id === groupId);
        if (!group) return;
        
        const updatedNodes = applyGroupAutoLayout(nodes, group);
        this.engine.setNodes(updatedNodes);
    }
}