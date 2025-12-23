import { NodeBehavior, NodePatch } from '@core/engine/types/behavior';
import { SynniaNode } from '@/types/project';

export const RACK_CONFIG = {
    PADDING_X: 15,
    PADDING_TOP: 50,
    GAP: 10,
    ASSET_HEIGHT: 50,
    ASSET_EXPANDED_DEFAULT: 200,
    DEFAULT_WIDTH: 280
};

/**
 * Vertical Stack Behavior (formerly RackStrategy).
 * Enforces a vertical list layout for children.
 */
export const VerticalStackBehavior: NodeBehavior = {

    /**
     * When a child is added, lock it and prepare it for the stack.
     */
    onChildAdd: (container, child, context) => {
        // Calculate target width immediately
        const rackWidth = container.style?.width ?? container.width ?? RACK_CONFIG.DEFAULT_WIDTH;
        const contentWidth = (rackWidth as number) - (RACK_CONFIG.PADDING_X * 2);

        return [{
            id: child.id,
            patch: {
                // Lock interaction
                draggable: false,
                extent: 'parent',
                // Reset dimensions to let the layout control them
                style: {
                    ...child.style,
                    width: contentWidth, // Snap to Rack width
                    height: child.style?.height ?? 240 // Default height if none
                },
                data: {
                    ...child.data,
                    handlePosition: 'left-right', // Optimize handles for stack
                    // Save original state for potential detach
                    originalPosition: {
                        x: child.position.x - container.position.x, // Relative
                        y: child.position.y - container.position.y
                    },
                    enableResize: false, // Disable manual resize inside Rack
                    originalWidth: child.style?.width // Backup original width
                } as any
            }
        }];
    },

    /**
     * When a child is removed, unlock it.
     */
    onChildRemove: (container, child, context) => {
        const originalPos = child.data.originalPosition as { x: number, y: number } | undefined;
        const originalWidth = (child.data as any).originalWidth as number | undefined;

        return [{
            id: child.id,
            patch: {
                draggable: true,
                extent: undefined, // Free range
                position: originalPos || child.position, // Restore if possible
                style: {
                    ...child.style,
                    width: originalWidth, // Restore original width
                    height: undefined // Let it auto-size or restore from expansion logic later
                },
                // Explicitly reset height prop for React Flow
                height: undefined,
                data: {
                    ...child.data,
                    collapsed: false, // Auto-expand on detach
                    handlePosition: 'top-bottom', // Restore standard handles
                    enableResize: true // Re-enable manual resize
                } as any
            }
        }];
    },

    /**
     * Handle Collapse/Expand.
     * When collapsed, hide all children.
     * When expanded, show all children.
     */
    onCollapse: (container, isCollapsed, context) => {
        const patches: NodePatch[] = [];

        // 1. Toggle Children Visibility
        const children = context.getNodes().filter(n => n.parentId === container.id);
        children.forEach(child => {
            patches.push({
                id: child.id,
                patch: { hidden: isCollapsed }
            });
        });

        // 2. Update Container State
        patches.push({
            id: container.id,
            patch: {
                data: { ...container.data, collapsed: isCollapsed },
                style: {
                    ...container.style,
                    // If collapsing, clear height to let CSS take over (or fix to header height)
                    // If expanding, let layout system recalculate it in the next frame
                    height: isCollapsed ? undefined : container.style?.height
                }
            }
        });

        return patches;
    },

    /**
     * The core layout engine.
     * Calculates vertical stack positions.
     */
    onLayout: (container, children, context) => {
        // 0. If Container is collapsed, enforce minimal height and ignore children
        if (container.data.collapsed) {
            return [{
                id: container.id,
                patch: {
                    // Clear height to allow auto-shrink to Header
                    style: {
                        ...container.style,
                        height: undefined
                    }
                }
            }];
        }

        if (children.length === 0) return [];

        const patches: NodePatch[] = [];

        // 1. Sort children by Y position to maintain visual order
        // (In a real stack, we might want to use a specific 'order' index, 
        // but sorting by current Y is a good heuristic for drag-to-reorder)
        const sortedChildren = [...children].sort((a, b) => a.position.y - b.position.y);

        let currentY = RACK_CONFIG.PADDING_TOP;

        // 2. Calculate Layout
        sortedChildren.forEach(child => {
            const h = getNodeHeight(child);
            // Prioritize style.width (Command) over measured width (Reality), fallback to Default
            const w = container.style?.width ?? container.width ?? RACK_CONFIG.DEFAULT_WIDTH;
            const contentWidth = (w as number) - (RACK_CONFIG.PADDING_X * 2);

            patches.push({
                id: child.id,
                patch: {
                    position: { x: RACK_CONFIG.PADDING_X, y: currentY },
                    style: {
                        ...child.style,
                        width: contentWidth,
                        // Do NOT overwrite height. Let the child maintain its own height state (fixed or auto).
                    },
                    // Ensure it's visible and locked
                    hidden: false,
                    draggable: false
                }
            });

            currentY += h + RACK_CONFIG.GAP;
        });

        // 3. Update Container Height
        const totalHeight = currentY + RACK_CONFIG.GAP;
        patches.push({
            id: container.id,
            patch: {
                height: totalHeight,
                style: {
                    ...container.style,
                    height: totalHeight
                }
            }
        });

        return patches;
    }
};

// --- Helpers ---

const getNodeHeight = (node: SynniaNode): number => {
    // 1. If explicitly collapsed by user (Asset Node self-collapse)
    if (node.data.collapsed) {
        return RACK_CONFIG.ASSET_HEIGHT;
    }

    // 2. Trust manual style height
    if (node.style?.height && typeof node.style.height === 'number') {
        return node.style.height;
    }

    // 3. Check measured height (avoid stale 0/small measurements)
    const measuredH = node.measured?.height ?? 0;
    if (measuredH > RACK_CONFIG.ASSET_HEIGHT + 10) {
        return measuredH;
    }

    // 4. Default
    return RACK_CONFIG.ASSET_EXPANDED_DEFAULT;
};
