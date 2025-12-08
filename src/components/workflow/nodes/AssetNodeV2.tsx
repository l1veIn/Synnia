import { memo } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import { SynniaNode, NodeType } from '@/types/project';
import { NodeShell } from './primitives/NodeShell';
import { NodeHeader, NodeHeaderAction } from './primitives/NodeHeader';
import { NodePort } from './primitives/NodePort';
import { useAsset } from '@/hooks/useAsset';
import { useRunAgent } from '@/hooks/useRunAgent';
import { nodesConfig } from './registry';
import { Play, CirclePause, Trash2 } from 'lucide-react';
import { useWorkflowStore } from '@/store/workflowStore';
import { toast } from 'sonner';

// Views
import { TextAssetView } from './views/TextAssetView';
import { ImageAssetView } from './views/ImageAssetView';
import { JsonAssetView } from './views/JsonAssetView';
import { FormAssetView } from './views/FormAssetView';
import { isFormAsset } from '@/types/assets';

export const AssetNodeV2 = memo((props: NodeProps<SynniaNode>) => {
  const { id, data, selected, type } = props;
  const { asset, setContent, exists } = useAsset(data.assetId);
  const { runAgent } = useRunAgent();
  const removeNode = useWorkflowStore((state) => state.removeNode);
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);

  const isRecipe = type === NodeType.RECIPE;
  const agentId = asset?.metadata?.extra?.agentId;
  const isBound = !!agentId;
  const state = data.state || 'idle';
  const isRunning = state === 'running';
  
  // Config Lookup
  const config = nodesConfig[type as NodeType];
  const Icon = config?.icon;
  const title = data.title || config?.title || 'Unknown';

  // Actions
  const handleRun = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRecipe) {
        if (!isBound) {
             toast.warning("Recipe not bound", { description: "Bind a logic agent in Inspector." });
             return;
        }
        runAgent(id, data.assetId!);
    } else {
        // Toggle run state for other nodes
        updateNodeData(id, { state: isRunning ? 'idle' : 'running' });
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
      e.stopPropagation();
      removeNode(id);
  };

  // Content Renderer
  const renderContent = () => {
    if (!exists || !asset) return <div className="p-4 text-xs text-destructive">Asset Missing</div>;

    switch (asset.type) {
        case 'text': return <TextAssetView asset={asset} onUpdate={setContent} />;
        case 'image': return <ImageAssetView asset={asset} onUpdate={setContent} />;
        case 'json':
            if (isFormAsset(asset.content)) {
                // Pass isNodeView=true to enable dynamic handles
                return <FormAssetView asset={asset} isNodeView={true} nodeId={id} />;
            }
            return <JsonAssetView asset={asset} />;
        default: return <div className="p-4 text-xs">Unknown Type</div>;
    }
  };

  return (
    <NodeShell selected={selected} state={state} className="min-w-[240px]">
      
      {/* 1. Top Port: Provenance / Input */}
      <NodePort type="target" position={Position.Top} />

      {/* 2. Header */}
      <NodeHeader 
        icon={Icon && <Icon className="h-4 w-4" />}
        title={title}
        actions={
            <>
                {/* Run Button: Always visible for Recipe, Conditional for others */}
                {(isRecipe || config?.category === 'Process') && (
                    <NodeHeaderAction 
                        onClick={handleRun}
                        title={isRecipe && !isBound ? "Bind recipe to run" : "Run"}
                        className={isRecipe && !isBound ? "opacity-50" : ""}
                    >
                        {isRunning ? <CirclePause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </NodeHeaderAction>
                )}
                <NodeHeaderAction onClick={handleDelete} title="Delete">
                    <Trash2 className="h-4 w-4 hover:text-destructive" />
                </NodeHeaderAction>
            </>
        }
      />

      {/* 3. Content Area */}
      <div className="p-3 min-h-[40px] flex-1 flex flex-col">
          {renderContent()}
      </div>

      {/* 4. Right Port: Reference (Recipe Only) */}
      {isRecipe && (
          <NodePort 
            type="source" 
            position={Position.Right} 
            id="reference" // Distinct ID for the reference output
          />
      )}

      {/* 5. Bottom Port: Product / Output */}
      <NodePort 
        type="source" 
        position={Position.Bottom} 
        isConnectable={!isRecipe} // Disabled for Recipe (Factory Mode)
      />

    </NodeShell>
  );
});

AssetNodeV2.displayName = 'AssetNodeV2';