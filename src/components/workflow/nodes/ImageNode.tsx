import { memo, useState, useEffect } from 'react';
import { NodeProps, Position, NodeResizer, useUpdateNodeInternals } from '@xyflow/react';
import { SynniaNode, NodeType } from '@/types/project';
import { NodeShell } from './primitives/NodeShell';
import { NodeHeader, NodeHeaderAction, NodeCollapseAction } from './primitives/NodeHeader';
import { NodePort } from './primitives/NodePort';
import { useAsset } from '@/hooks/useAsset';
import { Image as ImageIcon, Trash2 } from 'lucide-react';
import { useWorkflowStore } from '@/store/workflowStore';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { NodeConfig } from '@/types/node-config';
import { cn } from '@/lib/utils';
import { StandardAssetBehavior } from '@/lib/behaviors/StandardBehavior';

// --- Configuration ---
export const config: NodeConfig = {
    type: NodeType.IMAGE,
    title: 'Image',
    category: 'Asset',
    icon: ImageIcon,
    description: 'Image content',
    hidden: true,
};

export const behavior = StandardAssetBehavior;

// --- Inspector Component ---
export const ImageNodeInspector = ({ assetId }: { assetId: string }) => {
    const { asset, setContent } = useAsset(assetId);
    if (!asset) return <div className="p-4 text-xs">Asset Not Found</div>;
    
    let src = '';
    if (typeof asset.content === 'string') src = asset.content;
    else if (typeof asset.content === 'object' && asset.content && 'src' in asset.content) src = (asset.content as any).src;

    return (
        <div className="p-4 space-y-4">
             <div className="space-y-2">
                 <Label className="text-xs text-muted-foreground">Source URL / Path</Label>
                 <Input 
                    className="text-xs font-mono"
                    value={src}
                    onChange={(e) => setContent(e.target.value)}
                 />
             </div>
             <div className="space-y-1">
                 <Label className="text-xs text-muted-foreground">Dimensions</Label>
                 <div className="text-xs bg-muted p-2 rounded">
                     {asset.metadata.image?.width || '?'} x {asset.metadata.image?.height || '?'} px
                 </div>
             </div>
        </div>
    );
}

// --- Node Component ---
export const ImageNode = memo((props: NodeProps<SynniaNode>) => {
  const { id, data, selected } = props;
  const { asset, setContent } = useAsset(data.assetId);
  const removeNode = useWorkflowStore((state) => state.removeNode);
  const updateNode = useWorkflowStore((state) => state.updateNode);
  const serverPort = useWorkflowStore(s => s.serverPort);
  const updateNodeInternals = useUpdateNodeInternals();
  const state = data.state || 'idle';
  const isReadOnly = !!data.isReference;
  const isCollapsed = !!data.collapsed;
  const enableResize = data.other?.enableResize !== false;

  // Trigger re-measure when collapsed state changes
  useEffect(() => {
      updateNodeInternals(id);
  }, [isCollapsed, id, updateNodeInternals]);

  // Inline Logic
  const [localContent, setLocalContent] = useState('');
  
  useEffect(() => {
    if (!asset) return;
    let raw = asset.content;

    if (typeof raw === 'object' && raw !== null && 'src' in raw) {
        raw = (raw as any).src;
    }

    if (typeof raw !== 'string') {
        setLocalContent('');
        return;
    }

    if ((raw.startsWith('assets/') || raw.startsWith('assets\\')) && serverPort) {
        const filename = raw.replace(/\\/g, '/').split('/').pop();
        const url = `http://localhost:${serverPort}/assets/${filename}`;
        setLocalContent(url);
    } 
    else if (raw.startsWith('http') || raw.startsWith('data:')) {
        setLocalContent(raw);
    }
  }, [asset?.content, serverPort]);

  const { width, height } = asset?.metadata?.image || {};

  return (
    <NodeShell 
        selected={selected} 
        state={state} 
        className={cn("min-w-[200px]", isCollapsed ? "h-auto min-h-0" : "h-full")}
        dockedTop={!!data.dockedTo}
        dockedBottom={!!data.hasDockedFollower}
    >
      <NodeResizer 
        isVisible={selected && !isReadOnly && !isCollapsed && enableResize} 
        minWidth={200}
        minHeight={200}
        color="#3b82f6"
        handleStyle={{ width: 8, height: 8, borderRadius: 4 }}
        onResizeEnd={(_e, params) => {
            updateNode(id, {
                style: {
                    ...props.style,
                    width: params.width,
                    height: params.height,
                },
            });
        }}
      />
      
      <NodePort type="target" position={Position.Top} className="!bg-stone-400" isConnectable={!data.dockedTo} />
      
      <NodeHeader 
        className={cn(
            isCollapsed && "border-b-0",
            !!data.dockedTo ? "rounded-t-none" : "rounded-t-xl",
            isCollapsed && (!!data.hasDockedFollower ? "rounded-b-none" : "rounded-b-xl")
        )}
        icon={<ImageIcon className="h-4 w-4" />}
        title={data.title || 'Image'}
        actions={
            <>
                <NodeCollapseAction nodeId={id} isCollapsed={isCollapsed} />
                <NodeHeaderAction onClick={(e) => { e.stopPropagation(); removeNode(id); }} title="Delete">
                    <Trash2 className="h-4 w-4 hover:text-destructive" />
                </NodeHeaderAction>
            </>
        }
      />

      {!isCollapsed && (
          <div className="p-3 min-h-[40px] flex-1 flex flex-col">
              {asset ? (
                <div className="flex flex-col w-full h-full gap-1.5">
                    <Label className="text-xs text-muted-foreground select-none shrink-0">
                        {asset.metadata?.name || 'Image Content'}
                    </Label>
                    <div className="flex-1 min-h-0 flex items-center justify-center rounded-md overflow-hidden border bg-muted">
                        {imageUrl ? (
                            <img src={imageUrl} alt={asset.metadata?.name} className="max-w-full max-h-full object-contain" />
                        ) : (
                            <span className="text-muted-foreground text-xs italic">No Image</span>
                        )}
                    </div>
                </div>
              ) : (
                 <div className="text-destructive text-xs">Asset Missing</div>
              )}
          </div>
      )}

      <NodePort type="source" position={Position.Bottom} className="!bg-yellow-400" isConnectable={!data.hasDockedFollower} />
    </NodeShell>
  );
});
ImageNode.displayName = 'ImageNode';

// Standard Exports
export { ImageNode as Node, ImageNodeInspector as Inspector };
