import { BaseNodeFrame, BaseNodeFrameProps } from './base-node-frame';
import { useAsset } from '@/hooks/useAsset';
import { TextAssetView } from './views/TextAssetView';
import { ImageAssetView } from './views/ImageAssetView';

export function AssetNode(props: BaseNodeFrameProps) {
  const { data } = props;
  const { asset, setContent, exists } = useAsset(data.assetId);
  const isReadOnly = !!data.isReference;

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
          default:
              return <div className="text-xs text-muted-foreground">Unsupported Asset Type: {asset.type}</div>;
      }
  };

  return (
    <BaseNodeFrame {...props}>
      <div className="flex flex-col gap-3">
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
