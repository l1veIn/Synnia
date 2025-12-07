import { SynniaNode, NodeType } from '@/types/project';

export const RACK_CONFIG = {
    PADDING_X: 15,
    PADDING_TOP: 50,
    GAP: 10,
    ASSET_HEIGHT: 50, // Default height for collapsed asset/note nodes
    ASSET_EXPANDED_DEFAULT: 200,
    DEFAULT_WIDTH: 280
};

/**
 * Helpers to determine node height in Rack context.
 */
const getNodeHeight = (node: SynniaNode): number => {
    // If user collapsed it explicitly, use small height
    if (node.data.collapsed) {
        return RACK_CONFIG.ASSET_HEIGHT;
    }
    
    // Expanded Logic:
    // 1. Trust manual style height
    if (node.style?.height && typeof node.style.height === 'number') {
        return node.style.height;
    }
    
    // 2. Check measured height
    // CRITICAL FIX: If measured height is small (<= ASSET_HEIGHT + 10), it implies the node 
    // was just collapsed and hasn't re-rendered yet (stale data). Ignore it to prevent layout shrinking.
    const measuredH = node.measured?.height ?? 0;
    if (measuredH > RACK_CONFIG.ASSET_HEIGHT + 10) {
        return measuredH;
    }

    // 3. Fallback default
    return RACK_CONFIG.ASSET_EXPANDED_DEFAULT;
};

const getDepth = (nodeId: string, nodes: SynniaNode[]): number => {
    let depth = 0;
    let current = nodes.find(n => n.id === nodeId);
    while (current && current.parentId) {
        depth++;
        current = nodes.find(n => n.id === current.parentId);
    }
    return depth;
};

/**
 * Core Layout Engine: Re-calculates layout for ALL Rack Groups.
 */
export const fixRackLayout = (nodes: SynniaNode[]): SynniaNode[] => {
    // Include both RACK nodes and collapsed GROUP nodes
    const rackGroups = nodes.filter(n => 
        n.type === NodeType.RACK || 
        (n.type === NodeType.GROUP && n.data.collapsed)
    );
    
    if (rackGroups.length === 0) return nodes;
    
    // Sort by depth descending (Deepest -> Shallowest)
    const sortedGroups = [...rackGroups].sort((a, b) => getDepth(b.id, nodes) - getDepth(a.id, nodes));
    
    let currentNodes = [...nodes];
    
    sortedGroups.forEach(group => {
        // We must re-fetch the group from currentNodes because previous iterations might have updated it
        const freshGroup = currentNodes.find(n => n.id === group.id) || group;
        currentNodes = applyRackCollapse(currentNodes, freshGroup);
    });
    
    return currentNodes;
};

/**
 * Collapses (or Refreshes) a group into a "Rack" layout.
 */
export const applyRackCollapse = (nodes: SynniaNode[], group: SynniaNode): SynniaNode[] => {
    const children = nodes.filter(n => n.parentId === group.id);
    const sortedChildren = [...children].sort((a, b) => a.position.y - b.position.y);
    const childrenIds = new Set(sortedChildren.map(c => c.id));
    
    const groupTargetWidth = RACK_CONFIG.DEFAULT_WIDTH; 
    let currentY = RACK_CONFIG.PADDING_TOP;
    
    const layoutMap = new Map<string, { y: number, h: number }>();
    
    sortedChildren.forEach(child => {
        const h = getNodeHeight(child);
        layoutMap.set(child.id, { y: currentY, h });
        currentY += h + RACK_CONFIG.GAP;
    });
    
    const totalStackHeight = currentY + RACK_CONFIG.GAP; // Add bottom padding
    
    return nodes.map(n => {
        // Handle Group Itself
        if (n.id === group.id) {
                // Preserve original dimensions if not already stored
                const currentW = n.data.expandedWidth ?? (n.width as number) ?? 400;
                const currentH = n.data.expandedHeight ?? (n.height as number) ?? 300;
                
                return {
                    ...n,
                    width: groupTargetWidth,
                    height: totalStackHeight,
                    style: { ...n.style, width: groupTargetWidth, height: totalStackHeight },
                    data: {
                        ...n.data,
                        collapsed: true,
                        expandedWidth: currentW,
                        expandedHeight: currentH
                    }
                };
        }
        
        // Handle Children
        if (childrenIds.has(n.id)) {
            const layout = layoutMap.get(n.id)!;
            const isGroup = n.type === NodeType.GROUP;
            
            // Logic to determine if we should force collapse
            // If already in rack (handlePosition set), keep current state
            // If new to rack, force collapse (default to closed)
            const isAlreadyInRack = n.data.handlePosition === 'left-right';
            const shouldCollapse = isAlreadyInRack ? !!n.data.collapsed : true;

            return {
                ...n,
                hidden: false, 
                draggable: false, 
                position: { x: RACK_CONFIG.PADDING_X, y: layout.y },
                extent: 'parent',
                style: { 
                    ...n.style, 
                    width: groupTargetWidth - (RACK_CONFIG.PADDING_X * 2),
                    // If it's a group, we MUST explicit set height to what we calculated/read
                    // If it's an asset, setting undefined lets it auto-collapse to content (header)
                    height: isGroup ? n.style?.height : undefined 
                }, 
                data: {
                    ...n.data,
                    collapsed: shouldCollapse,
                    handlePosition: 'left-right',
                    // Only save original position if not already saved (avoid overwriting with rack pos)
                    originalPosition: n.data.originalPosition || { ...n.position } 
                }
            };
        }
        
        return n;
    });
};

/**
 * Expands a Rack back to a free-form Group.
 */
export const applyRackExpand = (nodes: SynniaNode[], group: SynniaNode): SynniaNode[] => {
    return nodes.map(n => {
        if (n.id === group.id) {
            const targetW = n.data.expandedWidth ?? 400;
            const targetH = n.data.expandedHeight ?? 300;
            
            return {
                ...n,
                width: targetW,
                height: targetH,
                style: { ...n.style, width: targetW, height: targetH },
                data: { ...n.data, collapsed: false }
            };
        }
        
        if (n.parentId === group.id) {
                const originalPos = n.data.originalPosition;
                return {
                    ...n,
                    draggable: true,
                    position: originalPos || n.position, 
                    style: { 
                        ...n.style, 
                        width: undefined,
                        height: undefined // Reset height constraint
                    },
                    data: {
                        ...n.data,
                        collapsed: false, // Un-collapse children? Usually yes.
                        handlePosition: 'top-bottom', 
                        originalPosition: undefined
                    }
                };
        }
        
        return n;
    });
};

/**
 * Automatically formats a node and inserts it into a Rack.
 * Uses fixRackLayout to ensure recursive resizing.
 */
export const insertNodeIntoRack = (
    nodes: SynniaNode[], 
    nodeToInsert: SynniaNode, 
    targetGroup: SynniaNode
): SynniaNode[] => {
    
    // 1. Clean/Sanitize node state for insertion
    const updatedDragNode = {
         ...nodeToInsert,
         parentId: targetGroup.id,
         extent: 'parent',
         draggable: false,
         // Temporary position, will be fixed by layout engine
         position: { x: RACK_CONFIG.PADDING_X, y: 0 }, 
         data: {
             ...nodeToInsert.data,
             collapsed: true, // Force collapse on insert
             handlePosition: 'left-right',
             originalPosition: { 
                 x: nodeToInsert.position.x - targetGroup.position.x, 
                 y: nodeToInsert.position.y - targetGroup.position.y 
             }
         }
    };
    
    // 2. Replace node in list
    const tempNodes = nodes.map(n => n.id === nodeToInsert.id ? updatedDragNode : n);
    
    // 3. Run Global Layout Fix
    return fixRackLayout(tempNodes);
};

/**
 * Perform a one-time Auto Layout (Vertical Stack) for an expanded Group.
 * This aligns children but keeps them unlocked and free.
 */
export const applyGroupAutoLayout = (nodes: SynniaNode[], group: SynniaNode): SynniaNode[] => {
    const children = nodes.filter(n => n.parentId === group.id);
    if (children.length === 0) return nodes;

    const sortedChildren = [...children].sort((a, b) => a.position.y - b.position.y);
    const childrenIds = new Set(sortedChildren.map(c => c.id));
    
    let currentY = RACK_CONFIG.PADDING_TOP;
    const layoutMap = new Map<string, { y: number }>();
    
    let maxWidth = 0;

    sortedChildren.forEach(child => {
        // In Free Layout, we respect current width/height.
        const h = (child.style?.height as number) ?? child.measured?.height ?? 100;
        const w = (child.style?.width as number) ?? child.measured?.width ?? 200;
        
        layoutMap.set(child.id, { y: currentY });
        currentY += h + RACK_CONFIG.GAP;
        maxWidth = Math.max(maxWidth, w);
    });
    
    const totalStackHeight = currentY + RACK_CONFIG.GAP;
    const requiredWidth = maxWidth + (RACK_CONFIG.PADDING_X * 2);

    return nodes.map(n => {
         if (n.id === group.id) {
             // Resize height/width to fit content, but don't shrink smaller than current if user made it big
             const currentW = (n.width as number) ?? 0;
             const currentH = (n.height as number) ?? 0;
             
             const newW = Math.max(currentW, requiredWidth);
             const newH = Math.max(currentH, totalStackHeight);
             
             return {
                 ...n,
                 width: newW,
                 height: newH,
                 style: { ...n.style, width: newW, height: newH },
                 // FIX: Sync expanded data so it persists across toggles
                 data: {
                     ...n.data,
                     expandedWidth: newW,
                     expandedHeight: newH
                 }
             };
         }

         if (childrenIds.has(n.id)) {
             const layout = layoutMap.get(n.id)!;
             return {
                 ...n,
                 position: { x: RACK_CONFIG.PADDING_X, y: layout.y },
                 // Do not change other props
             };
         }
         
         return n;
    });
};