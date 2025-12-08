import { memo, useState, useEffect } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import { SynniaNode, NodeType } from '@/types/project';
import { NodeShell } from './primitives/NodeShell';
import { NodeHeader, NodeHeaderAction, NodeCollapseAction } from './primitives/NodeHeader';
import { NodePort } from './primitives/NodePort';
import { useAsset } from '@/hooks/useAsset';
import { FileText, Trash2 } from 'lucide-react';
import { useWorkflowStore } from '@/store/workflowStore';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { NodeConfig } from '@/types/node-config';

// --- Configuration ---
export const config: NodeConfig = {
    type: NodeType.TEXT,
    title: 'Text',
    category: 'Asset',
    icon: FileText,
    description: 'Text content',
};

// --- Inspector Component ---
export const TextNodeInspector = ({ assetId }: { assetId: string }) => {
    const { asset, setContent } = useAsset(assetId);
    if (!asset) return <div className="p-4 text-xs text-muted-foreground">Asset Not Found</div>;

    return (
        <div className="p-4 space-y-4 h-full flex flex-col">
             <div className="space-y-2 flex-1 flex flex-col">
                 <Label className="text-xs text-muted-foreground">Text Content</Label>
                 <Textarea 
                    className="flex-1 font-mono text-xs resize-none"
                    value={asset.content as string}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Enter text here..."
                 />
             </div>
             <div className="text-[10px] text-muted-foreground font-mono">
                 ID: {asset.id}
             </div>
        </div>
    );
};

// --- Node Component ---
export const TextNode = memo((props: NodeProps<SynniaNode>) => {
  const { id, data, selected } = props;
  const { asset, setContent } = useAsset(data.assetId);
  const removeNode = useWorkflowStore((state) => state.removeNode);
  const state = data.state || 'idle';
  const isReadOnly = !!data.isReference;
  const isCollapsed = !!data.collapsed;

  // Inline View Logic
  const [localContent, setLocalContent] = useState('');

  useEffect(() => {
    if (asset) setLocalContent(asset.content as string || '');
  }, [asset?.content]);

  const handleBlur = () => {
    if (!isReadOnly && asset && localContent !== asset.content) {
        setContent(localContent);
    }
  };

  return (
    <NodeShell selected={selected} state={state} className="min-w-[200px]">
      <NodePort type="target" position={Position.Top} />
      
      <NodeHeader 
        icon={<FileText className="h-4 w-4" />}
        title={data.title || 'Text'}
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
                <div className="grid w-full gap-1.5">
                    <Label className="text-xs text-muted-foreground select-none">
                        {asset.metadata?.name || 'Text Content'}
                    </Label>
                    <Textarea 
                        value={localContent}
                        onChange={(e) => setLocalContent(e.target.value)}
                        onBlur={handleBlur}
                        disabled={isReadOnly}
                        className="text-xs resize-y min-h-[60px] nodrag bg-background/50 focus:bg-background transition-colors"
                        placeholder="Enter text..."
                    />
                </div>
              ) : (
                 <div className="text-destructive text-xs">Asset Missing</div>
              )}
          </div>
      )}

      <NodePort type="source" position={Position.Bottom} />
    </NodeShell>
  );
});
TextNode.displayName = 'TextNode';

// Standard Exports for Auto-Loader
export { TextNode as Node, TextNodeInspector as Inspector };