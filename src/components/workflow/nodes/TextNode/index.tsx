import { memo, useState, useEffect } from 'react';
import { NodeProps, Position, useUpdateNodeInternals, NodeResizer } from '@xyflow/react';
import { SynniaNode, NodeType } from '@/types/project';
import { NodeShell } from '../primitives/NodeShell';
import { NodeHeader, NodeHeaderAction, NodeCollapseAction } from '../primitives/NodeHeader';
import { NodePort } from '../primitives/NodePort';
import { useAsset } from '@/hooks/useAsset';
import { FileText, Trash2 } from 'lucide-react';
import { useWorkflowStore } from '@/store/workflowStore';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { NodeConfig } from '@/types/node-config';
import { cn } from '@/lib/utils';
import { StandardAssetBehavior } from '@/lib/behaviors/StandardBehavior';
import { TextNodeInspector } from './Inspector';

// --- Configuration ---
export const config: NodeConfig = {
    type: NodeType.TEXT,
    title: 'Text',
    category: 'Asset',
    icon: FileText,
    description: 'Text content',
};

export const behavior = StandardAssetBehavior;

// --- Node Component ---
export const TextNode = memo((props: NodeProps<SynniaNode>) => {
  const { id, data, selected } = props;
  const nodeStyle = (props as any).style || {};
  const { asset, setContent } = useAsset(data.assetId);
  const removeNode = useWorkflowStore((state) => state.removeNode);
  const updateNode = useWorkflowStore((state) => state.updateNode);
  const updateNodeInternals = useUpdateNodeInternals();
  const state = data.state || 'idle';
  const isReadOnly = !!data.isReference;
  const isCollapsed = !!data.collapsed;
  const other = (data.other as { enableResize?: boolean } | undefined);
  const enableResize = other?.enableResize !== false;

  // Trigger re-measure when collapsed state changes
  useEffect(() => {
    updateNodeInternals(id);
  }, [isCollapsed, id, updateNodeInternals]);

  // Inline View Logic
  const [localContent, setLocalContent] = useState('');

  useEffect(() => {
    if (asset) {
        // Handle both string and object content (from JSON editor)
        const val = typeof asset.content === 'object' 
            ? JSON.stringify(asset.content, null, 2) 
            : String(asset.content || '');
        setLocalContent(val);
    }
  }, [asset?.content]);

  const handleBlur = () => {
    if (!isReadOnly && asset && localContent !== asset.content) {
        // If content looks like JSON and was previously an object, should we try to parse it back?
        // For simplicity in TextNode, we save as string. 
        // The advanced JSON editor in Inspector handles object saving.
        setContent(localContent);
    }
  };

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
                    ...nodeStyle,
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
            data.dockedTo ? "rounded-t-none" : "rounded-t-xl",
            isCollapsed && (data.hasDockedFollower ? "rounded-b-none" : "rounded-b-xl")
        )}
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
          <div className="p-3 flex-1 flex flex-col h-full overflow-hidden">
              {asset ? (
                <div className="flex flex-col w-full h-full gap-1.5">
                    <Label className="text-xs text-muted-foreground select-none shrink-0">
                        {asset.metadata?.name || 'Text Content'}
                    </Label>
                    <Textarea 
                        value={localContent}
                        onChange={(e) => setLocalContent(e.target.value)}
                        onBlur={handleBlur}
                        disabled={isReadOnly}
                        className="text-xs resize-none h-full nodrag bg-background/50 focus:bg-background transition-colors"
                        placeholder="Enter text..."
                    />
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
TextNode.displayName = 'TextNode';

// Standard Exports for Auto-Loader
export { TextNode as Node, TextNodeInspector as Inspector };
