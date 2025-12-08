import { memo, useState, useEffect } from 'react';
import { NodeProps, Position, NodeResizer } from '@xyflow/react';
import { SynniaNode, NodeType } from '@/types/project';
import { NodeShell } from './primitives/NodeShell';
import { NodeHeader, NodeHeaderAction } from './primitives/NodeHeader';
import { NodePort } from './primitives/NodePort';
import { useAsset } from '@/hooks/useAsset';
import { Image as ImageIcon, Trash2 } from 'lucide-react';
import { useWorkflowStore } from '@/store/workflowStore';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { NodeConfig } from '@/types/node-config';

// --- Configuration ---
export const config: NodeConfig = {
    type: NodeType.IMAGE,
    title: 'Image',
    category: 'Asset',
    icon: ImageIcon,
    description: 'Image content',
};

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
  const serverPort = useWorkflowStore(s => s.serverPort);
  const state = data.state || 'idle';
  const isReadOnly = !!data.isReference;

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

    if ((raw.startsWith('assets/') || raw.startsWith('assets\')) && serverPort) {
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
    <NodeShell selected={selected} state={state} className="min-w-[200px] h-full">
      <NodeResizer 
        isVisible={selected && !isReadOnly} 
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
            <div className="flex flex-col w-full h-full gap-1.5">
                <Label className="text-xs text-muted-foreground select-none shrink-0">
                    {asset.metadata.name || 'Image Asset'}
                </Label>
                 {localContent && (
                  <div className="relative w-full flex-1 min-h-[100px] rounded-md overflow-hidden border bg-muted">
                    <img 
                        src={localContent} 
                        alt="Preview" 
                        loading="eager"
                        className="absolute inset-0 w-full h-full object-cover" 
                    />
                  </div>
                )}
                <div className="text-[10px] text-muted-foreground font-mono shrink-0">
                    {width ? `${width}x${height}` : ''}
                </div>
            </div>
          ) : (
             <div className="text-destructive text-xs">Asset Missing</div>
          )}
      </div>

      <NodePort type="source" position={Position.Bottom} />
    </NodeShell>
  );
});
ImageNode.displayName = 'ImageNode';

// Standard Exports
export { ImageNode as Node, ImageNodeInspector as Inspector };
