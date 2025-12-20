import { memo, useState, useEffect } from 'react';
import { NodeProps, NodeResizer, useUpdateNodeInternals } from '@xyflow/react';
import { SynniaNode, NodeType } from '@/types/project';
import { NodeShell } from '../primitives/NodeShell';
import { NodeHeader, NodeHeaderAction } from '../primitives/NodeHeader';
import { NodePort } from '../primitives/NodePort';
import { useNode } from '@/hooks/useNode';
import { FileText, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { StandardAssetBehavior } from '@/lib/behaviors/StandardBehavior';
import { TextNodeInspector } from './Inspector';
import type { NodeDefinition } from '@/lib/nodes/NodeRegistry';

// --- Node Component ---
export const TextNode = memo((props: NodeProps<SynniaNode>) => {
  const { id, selected } = props;
  const { state, actions } = useNode(id);
  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    updateNodeInternals(id);
  }, [state.isCollapsed, id, updateNodeInternals]);

  const [localContent, setLocalContent] = useState('');

  useEffect(() => {
    if (state.asset) {
      const val =
        typeof state.asset.content === 'object'
          ? JSON.stringify(state.asset.content, null, 2)
          : String(state.asset.content || '');
      setLocalContent(val);
    }
  }, [state.asset?.content]);

  const handleBlur = () => {
    if (!state.isReference && state.asset && localContent !== state.asset.content) {
      actions.updateContent(localContent);
    }
  };

  return (
    <NodeShell
      selected={selected}
      state={state.executionState as any}
      className={state.shellClassName}
      dockedTop={state.isDockedTop}
      dockedBottom={state.isDockedBottom}
    >
      <NodeResizer
        isVisible={selected && state.isResizable}
        minWidth={200}
        minHeight={200}
        color="#3b82f6"
        handleStyle={{ width: 8, height: 8, borderRadius: 4 }}
        onResizeEnd={(_e, params) => actions.resize(params.width, params.height)}
      />

      <NodePort.Origin show={state.hasProductHandle} />

      <NodeHeader
        className={state.headerClassName}
        icon={<FileText className="h-4 w-4" />}
        title={state.title}
        actions={
          <>
            <NodeHeaderAction onClick={actions.toggle} title={state.isCollapsed ? 'Expand' : 'Collapse'}>
              {state.isCollapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </NodeHeaderAction>
            <NodeHeaderAction onClick={(e) => { e.stopPropagation(); actions.remove(); }} title="Delete">
              <Trash2 className="h-4 w-4 hover:text-destructive" />
            </NodeHeaderAction>
          </>
        }
      />

      {!state.isCollapsed && (
        <div className="p-3 flex-1 flex flex-col h-full overflow-hidden">
          {state.asset ? (
            <div className="flex flex-col w-full h-full gap-1.5">
              <Label className="text-xs text-muted-foreground select-none shrink-0">
                {state.asset.metadata?.name || 'Text Content'}
              </Label>
              <Textarea
                value={localContent}
                onChange={(e) => setLocalContent(e.target.value)}
                onBlur={handleBlur}
                disabled={state.isReference}
                className="text-xs resize-none h-full nodrag bg-background/50 focus:bg-background transition-colors"
                placeholder="Enter text..."
              />
            </div>
          ) : (
            <div className="text-destructive text-xs">Asset Missing</div>
          )}
        </div>
      )}

      <NodePort.Output disabled={state.isDockedBottom} />
    </NodeShell>
  );
});
TextNode.displayName = 'TextNode';

// --- Node Definition (unified registration) ---
export const definition: NodeDefinition = {
  type: NodeType.TEXT,
  component: TextNode,
  inspector: TextNodeInspector,
  config: {
    type: NodeType.TEXT,
    title: 'Text',
    category: 'Asset',
    icon: FileText,
    description: 'Text content',

    requiresAsset: true,
    defaultAssetType: 'text',
    createNodeAlias: 'text',

    defaultStyle: { width: 250, height: 200 },

    createDefaultContent: () => '',
  },
  behavior: StandardAssetBehavior,
  ports: {
    static: [
      {
        id: 'output',
        direction: 'output',
        dataType: 'text',
        label: 'Text Output',
        resolver: (node, asset) => ({
          type: 'text',
          value: asset?.content || '',
          meta: { nodeId: node.id, portId: 'output' }
        })
      }
    ]
  },
  assetContentSchema: {
    content: { type: 'string', required: true, description: 'Text content' },
  }
};

// Legacy exports for compatibility
export { TextNode as Node, TextNodeInspector as Inspector };
export const config = definition.config;
export const behavior = definition.behavior;

