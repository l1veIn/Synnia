import { memo, useState, useEffect } from 'react';
import { NodeProps, NodeResizer, useUpdateNodeInternals } from '@xyflow/react';
import { SynniaNode, NodeType } from '@/types/project';
import { NodeShell } from '../primitives/NodeShell';
import { NodeHeader, NodeHeaderAction } from '../primitives/NodeHeader';
import { NodePort } from '../primitives/NodePort';
import { useNode } from '@/hooks/useNode';
import { useWorkflowStore } from '@/store/workflowStore';
import { Image as ImageIcon, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { StandardAssetBehavior } from '@core/registry/StandardBehavior';
import { Inspector } from './Inspector';
import type { NodeDefinition } from '@core/registry/NodeRegistry';
import { isImageAsset, ImageAsset } from '@/types/assets';

// --- Node Component ---
export const ImageNode = memo((props: NodeProps<SynniaNode>) => {
    const { id, selected } = props;
    const { state, actions } = useNode(id);
    const serverPort = useWorkflowStore(s => s.serverPort);
    const updateNodeInternals = useUpdateNodeInternals();

    useEffect(() => {
        updateNodeInternals(id);
    }, [state.isCollapsed, id, updateNodeInternals]);

    const [imageUrl, setImageUrl] = useState('');

    useEffect(() => {
        if (!state.asset) return;
        // New Asset API: value is the image URL/path string
        let raw = state.asset.value;

        if (typeof raw === 'object' && raw !== null && 'src' in raw) {
            raw = (raw as any).src;
        }

        if (typeof raw !== 'string') {
            setImageUrl('');
            return;
        }

        if ((raw.startsWith('assets/') || raw.startsWith('assets\\\\')) && serverPort) {
            const filename = raw.replace(/\\\\/g, '/').split('/').pop();
            const url = `http://localhost:${serverPort}/assets/${filename}`;
            setImageUrl(url);
        } else if (raw.startsWith('http') || raw.startsWith('data:')) {
            setImageUrl(raw);
        }
    }, [state.asset?.value, serverPort]);

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
                icon={<ImageIcon className="h-4 w-4" />}
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
                <div className="p-3 min-h-[40px] flex-1 flex flex-col overflow-hidden">
                    {state.asset ? (
                        <div className="flex flex-col w-full h-full gap-1.5">
                            <Label className="text-xs text-muted-foreground select-none shrink-0">
                                {state.asset.sys?.name || 'Image Content'}
                            </Label>
                            <div className="flex-1 min-h-0 flex items-center justify-center rounded-md overflow-hidden border bg-muted">
                                {imageUrl ? (
                                    <img
                                        src={imageUrl}
                                        alt={state.asset.sys?.name}
                                        className="max-w-full max-h-full object-contain"
                                    />
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

            <NodePort.Output disabled={state.isDockedBottom} />
        </NodeShell>
    );
});
ImageNode.displayName = 'ImageNode';

// Re-export from separate files
export { Inspector } from './Inspector';
export { definition } from './definition';
export { ImageNode as Node };

