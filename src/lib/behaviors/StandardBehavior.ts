import { NodeBehavior } from '@/lib/engine/types/behavior';

/**
 * Standard Behavior for Asset Nodes (Text, Image, etc.)
 * Handles Collapse/Expand logic with height backup/restore.
 */
export const StandardAssetBehavior: NodeBehavior = {
    onCollapse: (node, isCollapsed, context) => {
        const patches = [];
        
        // 1. Clone state to modify
        const newStyle = { ...node.style };
        const newOther = { ...(node.data.other || {}) };
        
        // 2. Determine Target Height
        let newHeight: number | undefined;

        if (isCollapsed) {
            // --- Collapsing Logic ---
            
            // A. Backup current height if it's a valid number (and not already collapsed size)
            // Priority: style.height > measured.height > node.height
            let currentHeight = node.style?.height;
            if (typeof currentHeight !== 'number') {
                 currentHeight = node.measured?.height || node.height;
            }

            if (typeof currentHeight === 'number' && currentHeight > 60) {
                newOther.expandedHeight = currentHeight;
            }

            // B. Force small height (Header height)
            newHeight = 50; 

        } else {
            // --- Expanding Logic ---
            
            // A. Restore backup if exists
            if (newOther.expandedHeight) {
                newHeight = newOther.expandedHeight;
            }
            // B. Otherwise leave undefined (Auto-height / Default)
        }

        // 3. Generate Patch
        patches.push({
            id: node.id,
            patch: {
                // Explicitly update both style and top-level height to force React Flow update
                height: newHeight, 
                style: { 
                    ...newStyle, 
                    height: newHeight 
                },
                data: { 
                    ...node.data, 
                    collapsed: isCollapsed,
                    other: newOther
                }
            }
        });

        return patches;
    }
};
