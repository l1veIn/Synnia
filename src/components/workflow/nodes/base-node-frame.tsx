import { memo } from 'react';
import { Position, NodeProps } from '@xyflow/react';
import { BaseNode } from '../ui/base-node';
import { 
  NodeHeader, 
  NodeHeaderIcon, 
  NodeHeaderTitle, 
  NodeHeaderActions, 
  NodeHeaderAction 
} from '../ui/node-header';
import { BaseHandle } from '../ui/base-handle';
import { nodesConfig } from './registry';
import { SynniaNode, NodeType } from '@/types/project';
import { Trash2, Play, CirclePause, AlertCircle } from 'lucide-react';
import { useWorkflowStore } from '@/store/workflowStore';

// 扩展 React Flow 的 NodeProps
export type BaseNodeFrameProps = NodeProps<SynniaNode> & {
  children?: React.ReactNode;
  // onToggleRun 目前还是通过 props 传，或者后续也在内部实现
  onToggleRun?: () => void;
};

export const BaseNodeFrame = memo(({ 
  id, 
  data, 
  type, 
  selected, 
  children,
  onToggleRun
}: BaseNodeFrameProps) => {
  const removeNode = useWorkflowStore((state) => state.removeNode);
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);

  // 安全地转换 type
  const nodeType = type as NodeType;
  const config = nodesConfig[nodeType];
  const Icon = config?.icon;
  
  const title = data.title || config?.title || 'Unknown Node';
  const state = data.state || 'idle';
  const isRunning = state === 'running';

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeNode(id);
  };

  const handleToggleRun = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleRun) {
      onToggleRun();
    } else {
      // 默认的 toggle 逻辑：只是切换状态，方便测试
      updateNodeData(id, { state: isRunning ? 'idle' : 'running' });
    }
  };

  return (
    <BaseNode selected={selected} state={state} className="min-w-[240px]">
      {/* 顶部 Handle - Input */}
      <BaseHandle 
        type="target" 
        position={Position.Top} 
        className="-top-2" 
      />

      <NodeHeader>
        <NodeHeaderIcon>
          {state === 'error' ? (
            <AlertCircle className="h-4 w-4 text-destructive" />
          ) : (
            Icon && <Icon className="h-4 w-4" />
          )}
        </NodeHeaderIcon>
        
        <NodeHeaderTitle>{title}</NodeHeaderTitle>
        
        <NodeHeaderActions>
           {/* 运行/暂停按钮 */}
           {config?.category === 'Process' && (
             <NodeHeaderAction 
                onClick={handleToggleRun}
                title={isRunning ? "Pause" : "Run"}
              >
               {isRunning ? <CirclePause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
             </NodeHeaderAction>
           )}
           
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
      <div className="p-3 min-h-[40px]">
        {data.errorMessage && (
          <div className="mb-2 text-xs text-destructive bg-destructive/10 p-2 rounded border border-destructive/20">
            {data.errorMessage}
          </div>
        )}
        {children}
      </div>

      {/* 底部 Handle - Output */}
      <BaseHandle 
        type="source" 
        position={Position.Bottom} 
        className="-bottom-2"
      />
    </BaseNode>
  );
});

BaseNodeFrame.displayName = 'BaseNodeFrame';
