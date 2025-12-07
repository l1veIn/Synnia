import { BaseNodeFrame, BaseNodeFrameProps } from './base-node-frame';
import { useAsset } from '@/hooks/useAsset';
import { TextAssetView } from './views/TextAssetView';
import { ImageAssetView } from './views/ImageAssetView';
import { JsonAssetView } from './views/JsonAssetView';
import { FormAssetView } from './views/FormAssetView';
import { isFormAsset } from '@/types/assets';
import { NodeResizer } from '@xyflow/react';
import { useRunAgent } from '@/hooks/useRunAgent';
import { NodeType } from '@/types/project';
import { toast } from 'sonner';

export function AssetNode(props: BaseNodeFrameProps) {
  const { id, data, selected, type } = props;
  const { asset, setContent, exists } = useAsset(data.assetId);
  const { runAgent } = useRunAgent();
  const isReadOnly = !!data.isReference;

  // Check if this asset has a bound agent/recipe
  const agentId = asset?.metadata?.extra?.agentId;
  const isRecipeNode = type === NodeType.RECIPE;
  const isBound = !!agentId;

  const handleRun = () => {
      if (agentId && data.assetId) {
          runAgent(id, data.assetId);
      }
  };
  
  const handleDisabledRun = () => {
      toast("Recipe not bound", {
          description: "Please select the node and choose a Logic in the Inspector panel.",
      });
  };

  // Dispatcher Logic: Choose the right view based on Asset Type
  const renderContent = () => {
      if (!exists || !asset) {
          // Legacy Fallback for nodes created before V2 migration
          if (data.content) {
             return (
                 <div className="p-2 border border-dashed rounded bg-muted/20">
                     <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Legacy Content</div>
                     <div className="text-xs whitespace-pre-wrap font-mono">{data.content as string}</div>
                 </div>
             );
          }
          return <div className="text-xs text-destructive font-mono">Asset Not Found (ID: {data.assetId})</div>;
      }

      switch (asset.type) {
          case 'text':
              return <TextAssetView asset={asset} isReadOnly={isReadOnly} onUpdate={setContent} />;
          case 'image':
              return <ImageAssetView asset={asset} isReadOnly={isReadOnly} onUpdate={setContent} />;
          case 'json':
              // Smart Routing: Check if it's a Structured Form or Raw JSON
              if (isFormAsset(asset.content)) {
                  return <FormAssetView asset={asset} />;
              }
              return <JsonAssetView asset={asset} />;
          default:
              return <div className="text-xs text-muted-foreground">Unsupported Asset Type: {asset.type}</div>;
      }
  };

  return (
    <BaseNodeFrame 
        {...props} 
        onToggleRun={isBound ? handleRun : undefined}
        isRunDisabled={isRecipeNode && !isBound}
        onRunDisabledClick={handleDisabledRun}
        isSourceConnectable={!isRecipeNode} // Disable manual output connection for Recipe Nodes (Factory Mode)
    >
      <NodeResizer 
        isVisible={selected && !isReadOnly && !isRecipeNode} 
        minWidth={200} 
        minHeight={200}
        color="#3b82f6"
        handleStyle={{ width: 8, height: 8, borderRadius: 4 }}
      />
      <div className="flex flex-col gap-3 h-full overflow-hidden">
        {isReadOnly && (
            <div className="flex items-center gap-1 text-[10px] text-blue-500 font-medium uppercase tracking-wider select-none">
                <span className="bg-blue-100 px-1 rounded">REF</span>
                <span>Read Only</span>
            </div>
        )}
        
        {renderContent()}
      </div>
    </BaseNodeFrame>
  );
}
