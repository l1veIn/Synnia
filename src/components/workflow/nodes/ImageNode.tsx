import { memo } from 'react';
import { NodeProps, Position, NodeResizer } from '@xyflow/react';
import { SynniaNode } from '@/types/project';
import { NodeShell } from './primitives/NodeShell';
import { NodeHeader, NodeHeaderAction } from './primitives/NodeHeader';
import { NodePort } from './primitives/NodePort';
import { useAsset } from '@/hooks/useAsset';
import { ImageAssetView } from './views/ImageAssetView';
import { Image as ImageIcon, Trash2 } from 'lucide-react';
import { useWorkflowStore } from '@/store/workflowStore';

export const ImageNode = memo((props: NodeProps<SynniaNode>) => {
  const { id, data, selected } = props;
  const { asset, setContent } = useAsset(data.assetId);
  const removeNode = useWorkflowStore((state) => state.removeNode);
  const state = data.state || 'idle';

  return (
    <NodeShell selected={selected} state={state} className="min-w-[200px] h-full">
      <NodeResizer 
        isVisible={selected && !data.isReference} 
        minWidth={200}
        minHeight={200}
        color="#3b82f6"
        handleStyle={{ width: 8, height: 8, borderRadius: 4 }}
      />
      
      <NodePort type="target" position={Position.Top} />
      
      <NodeHeader 
        icon={<ImageIcon className="h-4 w-4" />}
        title={data.title || 'Image'}
        actions={
            <NodeHeaderAction onClick={(e) => { e.stopPropagation(); removeNode(id); }} title="Delete">
                <Trash2 className="h-4 w-4 hover:text-destructive" />
            </NodeHeaderAction>
        }
      />

      <div className="p-3 min-h-[40px] flex-1 flex flex-col h-full overflow-hidden">
          {asset ? (
             <ImageAssetView asset={asset} onUpdate={setContent} isReadOnly={!!data.isReference} />
          ) : (
             <div className="text-destructive text-xs">Asset Missing</div>
          )}
      </div>

      <NodePort type="source" position={Position.Bottom} />
    </NodeShell>
  );
});
ImageNode.displayName = 'ImageNode';