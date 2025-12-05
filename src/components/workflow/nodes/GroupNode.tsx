import { memo } from 'react';
import { NodeResizer, NodeProps, Handle, Position } from '@xyflow/react';
import { SynniaNode } from '@/types/project';
import { cn } from '@/lib/utils';
import { useWorkflowStore } from '@/store/workflowStore';
import { useHistory } from '@/hooks/useHistory';
import { Trash2 } from 'lucide-react';

export const GroupNode = memo(({ id, selected, data }: NodeProps<SynniaNode>) => {
  const removeNode = useWorkflowStore((state) => state.removeNode);
  const triggerCommit = useWorkflowStore((state) => state.triggerCommit);
  const highlightedGroupId = useWorkflowStore((state) => state.highlightedGroupId);
  const { pause, resume } = useHistory();
  
  const isHighlighted = highlightedGroupId === id;

  // 简单的删除逻辑
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeNode(id);
  };
  
  const onResizeStart = () => pause();
  const onResizeEnd = () => {
      resume();
      triggerCommit();
  };

  return (
    <div
      className={cn(
        'relative h-full w-full rounded-xl border-2 border-dashed transition-all duration-200',
        selected ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 bg-muted/10',
        isHighlighted ? 'border-primary bg-primary/10 ring-4 ring-primary/20 scale-[1.01]' : '',
        'group' // for hover effects
      )}
    >
      <Handle 
        type="target" 
        position={Position.Top} 
        className="w-3 h-3 bg-muted-foreground border-2 border-background -top-1.5 left-1/2 -translate-x-1/2 transition-all duration-200 hover:bg-primary hover:border-primary hover:ring-2 hover:ring-offset-1 hover:ring-primary/40" 
      />

      <NodeResizer 
        isVisible={selected} 
        minWidth={300} 
        minHeight={200}
        lineClassName="border-primary"
        handleClassName="h-3 w-3 bg-primary border-2 border-background rounded"
        onResizeStart={onResizeStart}
        onResizeEnd={onResizeEnd}
      />
      
      {/* 标题栏 */}
      <div className="absolute -top-8 left-0 flex items-center gap-2">
        <span className="text-sm font-bold text-muted-foreground group-hover:text-primary transition-colors px-1">
          {data.title || 'Group'}
        </span>
        
        {/* 只有选中时才显示删除按钮，避免误触 */}
        {selected && (
           <button 
             onClick={handleDelete}
             className="p-1 rounded-full hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
             title="Delete Group"
           >
             <Trash2 className="w-3 h-3" />
           </button>
        )}
      </div>

      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="w-3 h-3 bg-muted-foreground border-2 border-background -bottom-1.5 left-1/2 -translate-x-1/2 transition-all duration-200 hover:bg-primary hover:border-primary hover:ring-2 hover:ring-offset-1 hover:ring-primary/40" 
      />
    </div>
  );
});

GroupNode.displayName = 'GroupNode';
