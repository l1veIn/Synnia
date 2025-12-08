import { memo } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import { SynniaNode } from '@/types/project';
import { NodeShell } from './primitives/NodeShell';
import { NodeHeader, NodeHeaderAction } from './primitives/NodeHeader';
import { NodePort } from './primitives/NodePort';
import { useAsset } from '@/hooks/useAsset';
import { useRunAgent } from '@/hooks/useRunAgent';
import { FormAssetView } from './views/FormAssetView';
import { Play, CirclePause, Trash2, ScrollText } from 'lucide-react';
import { useWorkflowStore } from '@/store/workflowStore';
import { toast } from 'sonner';

export const RecipeNode = memo((props: NodeProps<SynniaNode>) => {
  const { id, data, selected } = props;
  const { asset } = useAsset(data.assetId);
  const { runAgent } = useRunAgent();
  const removeNode = useWorkflowStore((state) => state.removeNode);
  
  const agentId = asset?.metadata?.extra?.agentId;
  const isBound = !!agentId;
  const state = data.state || 'idle';
  const isRunning = state === 'running';

  const handleRun = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isBound) {
         toast.warning("Recipe not bound", { description: "Bind a logic agent in Inspector." });
         return;
    }
    runAgent(id, data.assetId!);
  };

  const handleDelete = (e: React.MouseEvent) => {
      e.stopPropagation();
      removeNode(id);
  };

  return (
    <NodeShell selected={selected} state={state} className="min-w-[240px]">
      <NodePort type="target" position={Position.Top} />
      
      <NodeHeader 
        icon={<ScrollText className="h-4 w-4" />}
        title={data.title || asset?.metadata?.name || 'Recipe'}
        actions={
            <>
                <NodeHeaderAction 
                    onClick={handleRun}
                    title={!isBound ? "Bind recipe to run" : "Run"}
                    className={!isBound ? "opacity-50" : ""}
                >
                    {isRunning ? <CirclePause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </NodeHeaderAction>
                <NodeHeaderAction onClick={handleDelete} title="Delete">
                    <Trash2 className="h-4 w-4 hover:text-destructive" />
                </NodeHeaderAction>
            </>
        }
      />

      <div className="p-3 min-h-[40px] flex-1 flex flex-col">
          {asset ? (
             <FormAssetView asset={asset} isNodeView={true} nodeId={id} />
          ) : (
             <div className="text-destructive text-xs">Asset Missing</div>
          )}
      </div>

      <NodePort type="source" position={Position.Right} id="reference" />
      <NodePort type="source" position={Position.Bottom} isConnectable={false} />
    </NodeShell>
  );
});
RecipeNode.displayName = 'RecipeNode';