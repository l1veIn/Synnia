import { memo } from 'react';
import { NodeResizer, NodeProps, Handle, Position } from '@xyflow/react';
import { SynniaNode, NodeType } from '@/types/project';
import { cn } from '@/lib/utils';
import { useWorkflowStore } from '@/store/workflowStore';
import { useHistory } from '@/hooks/useHistory';
import { Trash2, ChevronDown, ChevronUp, BoxSelect, AlignJustify, Box } from 'lucide-react';
import { NodeConfig } from '@/types/node-config';
import { graphEngine } from '@/lib/engine/GraphEngine';

// --- Configuration ---
export const config: NodeConfig = {
  type: NodeType.GROUP,
  title: 'Group',
  category: 'Container',
  icon: Box,
  description: 'A collapsible group container',
  defaultWidth: 400,
  defaultHeight: 300,
  hidden: true,
};

// --- Node Component ---
export const GroupNode = memo(({ id, selected, data }: NodeProps<SynniaNode>) => {
  const triggerCommit = useWorkflowStore((state) => state.triggerCommit);
  const highlightedGroupId = useWorkflowStore((state) => state.highlightedGroupId);

  const { pause, resume } = useHistory();

  const isHighlighted = highlightedGroupId === id;
  const isCollapsed = !!data.collapsed;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    graphEngine.mutator.removeNode(id);
  };

  const handleAutoLayout = (e: React.MouseEvent) => {
    e.stopPropagation();
    graphEngine.layout.autoLayoutGroup(id);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    graphEngine.layout.toggleGroupCollapse(id);
  };

  const onResizeStart = () => pause();
  const onResizeEnd = () => {
    resume();
    triggerCommit();
  };

  return (
    <>
      <NodeResizer
        isVisible={selected && !isCollapsed}
        minWidth={200}
        minHeight={100}
        lineClassName="border-primary"
        handleClassName="h-3 w-3 bg-primary border-2 border-background rounded"
        onResizeStart={onResizeStart}
        onResizeEnd={onResizeEnd}
      />

      <div
        className={cn(
          'relative transition-all duration-300 rounded-2xl border-2',
          // Base Styles
          isCollapsed
            ? 'w-full h-full bg-card border-solid border-border shadow-sm' // Collapsed: Solid Card
            : 'h-full w-full bg-muted/5 backdrop-blur-[1px] border-dashed border-muted-foreground/20', // Expanded: Glass Frame

          // Selection / Highlight Styles
          selected && !isCollapsed && 'border-primary bg-primary/5',
          selected && isCollapsed && 'border-primary ring-1 ring-primary',
          isHighlighted && 'border-primary bg-primary/10 ring-4 ring-primary/20 scale-[1.01]',

          'group' // for hover effects
        )}
      >
        {/* Top Handle (Always visible) */}
        <Handle
          type="target"
          position={Position.Top}
          className="w-3 h-3 bg-muted-foreground border-2 border-background -top-1.5 left-1/2 -translate-x-1/2 transition-all duration-200 hover:bg-primary hover:border-primary"
        />

        {/* Header Area */}
        <div className={cn(
          "absolute left-0 px-3 py-2 flex items-center gap-2 transition-all duration-300 z-10",
          // Expanded: Top-Left floating header
          // Collapsed: Full width header at Top
          isCollapsed ? "top-0 w-full justify-between border-b bg-muted/20 rounded-t-xl" : "top-0"
        )}>
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggle}
              className="nodrag p-0.5 rounded hover:bg-muted-foreground/10 text-muted-foreground transition-colors"
            >
              {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>

            <span className={cn(
              "font-semibold text-muted-foreground flex items-center gap-1 select-none",
              isCollapsed && "text-foreground"
            )}>
              <BoxSelect className="w-3 h-3 opacity-70" />
              {data.title || 'Group'}
            </span>
          </div>

          {/* Actions */}
          {selected && (
            <div className="flex items-center gap-1">
              {!isCollapsed && (
                <button
                  onClick={handleAutoLayout}
                  className="nodrag p-1 rounded-full hover:bg-muted-foreground/10 text-muted-foreground transition-colors"
                  title="Auto Layout Children"
                >
                  <AlignJustify className="w-3 h-3" />
                </button>
              )}
              <button
                onClick={handleDelete}
                className="nodrag p-1 rounded-full hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                title="Delete Group"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Bottom Handle (Always visible) */}
        <Handle
          type="source"
          position={Position.Bottom}
          className="w-3 h-3 bg-muted-foreground border-2 border-background -bottom-1.5 left-1/2 -translate-x-1/2 transition-all duration-200 hover:bg-primary hover:border-primary"
        />
      </div>
    </>
  );
});

GroupNode.displayName = 'GroupNode';

export { GroupNode as Node };