import { memo, useEffect } from 'react';
import { Position, NodeProps, useUpdateNodeInternals } from '@xyflow/react';
import { BaseNode } from '../ui/base-node';
import { 
  NodeHeader, 
  NodeHeaderIcon, 
  NodeHeaderTitle, 
  NodeHeaderActions, 
  NodeHeaderAction 
} from '../ui/node-header';
import { BaseHandle } from '../ui/base-handle';
import { nodesConfig } from '.';
import { SynniaNode, NodeType } from '@/types/project';
import { Trash2, Play, CirclePause, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useWorkflowStore } from '@/store/workflowStore';
import { cn } from '@/lib/utils';

// 扩展 React Flow 的 NodeProps
export type BaseNodeFrameProps = NodeProps<SynniaNode> & {
  children?: React.ReactNode;
  // onToggleRun 目前还是通过 props 传，或者后续也在内部实现
  onToggleRun?: () => void;
  isRunDisabled?: boolean;
  onRunDisabledClick?: () => void;
  isSourceConnectable?: boolean;
};

export const BaseNodeFrame = memo(({ 
  id, 
  data, 
  type, 
  selected, 
  children,
  onToggleRun,
  isRunDisabled,
  onRunDisabledClick,
  isSourceConnectable
}: BaseNodeFrameProps) => {
  const removeNode = useWorkflowStore((state) => state.removeNode);
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const toggleNodeCollapse = useWorkflowStore((state) => state.toggleNodeCollapse);
  const updateNodeInternals = useUpdateNodeInternals();

  // 安全地转换 type
  const nodeType = type as NodeType;
  const config = nodesConfig[nodeType];
  const Icon = config?.icon;
  
  const title = data.title || config?.title || 'Unknown Node';
  const state = data.state || 'idle';
  const isRunning = state === 'running';
  const isCollapsed = !!data.collapsed;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeNode(id);
  };

  const handleToggleRun = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRunDisabled) {
        if (onRunDisabledClick) onRunDisabledClick();
        return;
    }
    if (onToggleRun) {
      onToggleRun();
    } else {
      // 默认的 toggle 逻辑：只是切换状态，方便测试
      updateNodeData(id, { state: isRunning ? 'idle' : 'running' });
    }
  };

  const handleToggleCollapse = (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleNodeCollapse(id);
  };

  const handlePos = data.handlePosition || 'top-bottom';
  
  // Force update handles when position mode changes
  useEffect(() => {
      updateNodeInternals(id);
  }, [handlePos, id, updateNodeInternals]);

  const isLeftRight = handlePos === 'left-right';
  
  const targetPosition = isLeftRight ? Position.Left : Position.Top;
  const sourcePosition = isLeftRight ? Position.Right : Position.Bottom;

  const targetClass = isLeftRight 
    ? "-left-2 top-1/2 -translate-y-1/2" 
    : "-top-2 left-1/2 -translate-x-1/2";
  
  const sourceClass = isLeftRight
    ? "-right-2 top-1/2 -translate-y-1/2"
    : "-bottom-2 left-1/2 -translate-x-1/2";

  const handleKeySuffix = isLeftRight ? 'lr' : 'tb';

  return (
    <BaseNode selected={selected} state={state} className="min-w-[240px] h-full">
      {/* Input Handle */}
      <BaseHandle 
        key={`target-${handleKeySuffix}`}
        type="target" 
        position={targetPosition} 
        className={targetClass}
      />

      <NodeHeader className={cn("rounded-t-xl", isCollapsed && "rounded-b-xl border-b-0")}>
        <NodeHeaderIcon>
          {state === 'error' ? (
            <AlertCircle className="h-4 w-4 text-destructive" />
          ) : (
            Icon && <Icon className="h-4 w-4" />
          )}
        </NodeHeaderIcon>
        
        <NodeHeaderTitle>{title}</NodeHeaderTitle>
        
        <NodeHeaderActions>
           {/* Run/Pause Button - Show if explicitly provided via props (e.g. Bound Recipe) OR if category is Process */}
           {(onToggleRun || config?.category === 'Process') && (
             <NodeHeaderAction 
                onClick={handleToggleRun}
                title={isRunDisabled ? "Bind a recipe to run" : (isRunning ? "Pause" : "Run")}
                className={cn(isRunDisabled && "opacity-40 cursor-not-allowed hover:bg-transparent text-muted-foreground hover:text-muted-foreground")}
              >
               {isRunning ? <CirclePause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
             </NodeHeaderAction>
           )}
           
           <NodeHeaderAction
              onClick={handleToggleCollapse}
              title={isCollapsed ? "Expand" : "Collapse"}
           >
              {isCollapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
           </NodeHeaderAction>

           <NodeHeaderAction 
              onClick={handleDelete}
              className="hover:text-destructive"
              title="Delete"
            >
             <Trash2 className="h-4 w-4" />
           </NodeHeaderAction>
        </NodeHeaderActions>
      </NodeHeader>

      {/* 内容区域 */}
      {!isCollapsed && (
        <div className="p-3 min-h-[40px] flex-1 flex flex-col">
          {data.errorMessage && (
            <div className="mb-2 text-xs text-destructive bg-destructive/10 p-2 rounded border border-destructive/20">
              {data.errorMessage}
            </div>
          )}
          {children}
        </div>
      )}

      {/* Output Handle */}
      <BaseHandle 
        key={`source-${handleKeySuffix}`}
        type="source" 
        position={sourcePosition} 
        className={sourceClass}
        isConnectable={isSourceConnectable !== false}
      />
    </BaseNode>
  );
});

BaseNodeFrame.displayName = 'BaseNodeFrame';