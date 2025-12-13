import { memo } from 'react';
import { NodeProps, Position, NodeResizer, useNodeConnections } from '@xyflow/react';
import { SynniaNode, NodeType } from '@/types/project';
import { NodeShell } from '../primitives/NodeShell';
import { NodeHeader, NodeHeaderAction } from '../primitives/NodeHeader';
import { NodePort } from '../primitives/NodePort';
import { useNode } from '@/hooks/useNode';
import { useRunAgent } from '@/hooks/useRunAgent';
import { Play, CirclePause, Trash2, ScrollText, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { FormAssetContent, FieldDefinition } from '@/types/assets';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { RecipeNodeInspector } from './Inspector';
import { NodeConfig } from '@/types/node-config';
import { StandardAssetBehavior } from '@/lib/behaviors/StandardBehavior';

// --- Configuration ---
export const config: NodeConfig = {
    type: NodeType.RECIPE,
    title: 'Recipe',
    category: 'Process',
    icon: Play,
    description: 'Processing unit',
};

// --- Behavior ---
export const behavior = StandardAssetBehavior;

export { RecipeNode as Node, RecipeNodeInspector as Inspector };

// --- Inner Components ---

const RecipeFieldRow = ({
    field,
    value,
}: {
    field: FieldDefinition;
    value: any;
}) => {
    const connections = useNodeConnections({
        handleType: 'target',
        handleId: field.key,
    });
    const isConnected = connections.length > 0;
    const isMissing =
        field.rules?.required && (value === undefined || value === '' || value === null);

    return (
        <div className="relative flex items-center justify-between gap-2 overflow-visible group min-h-[20px]">
            {field.widget === 'node-input' && (
                <NodePort
                    type="target"
                    position={Position.Left}
                    id={field.key}
                    className={cn(
                        'left-[-12px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 border-2 border-background !bg-blue-500 !border-blue-500'
                    )}
                />
            )}

            <span
                className={cn(
                    'shrink-0 max-w-[80px] truncate',
                    isMissing && !isConnected ? 'text-destructive font-bold' : 'text-muted-foreground'
                )}
                title={field.label || field.key}
            >
                {field.label || field.key}:
            </span>

            {isConnected ? (
                <span className="text-blue-500 text-[10px] italic font-medium truncate max-w-[120px] flex items-center gap-1 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                    Linked
                </span>
            ) : (
                <span
                    className="text-foreground truncate font-medium bg-muted/50 px-1.5 py-0.5 rounded max-w-[120px]"
                    title={String(value)}
                >
                    {value === undefined || value === '' ? (
                        <span className="text-muted-foreground/50">-</span>
                    ) : (
                        String(value)
                    )}
                </span>
            )}
        </div>
    );
};

// --- Main Node ---

export const RecipeNode = memo((props: NodeProps<SynniaNode>) => {
    const { id, selected } = props;
    const { state, actions } = useNode(id);
    const { runAgent } = useRunAgent();

    const agentId = state.asset?.metadata?.extra?.agentId;
    const isBound = !!agentId;
    const isRunning = state.executionState === 'running';

    const handleRun = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isBound) {
            toast.warning('Recipe not bound', { description: 'Bind a logic agent in Inspector.' });
            return;
        }
        runAgent(id, state.node?.data.assetId!);
    };

    // Helper render
    const renderContent = () => {
        if (!state.asset) return <div className="text-destructive text-xs">Asset Missing</div>;

        const content = state.asset.content as FormAssetContent;
        const { schema, values } = content;

        if (!schema || schema.length === 0) {
            return (
                <div className="flex flex-col w-full h-full text-xs items-center justify-center text-muted-foreground italic">
                    <span className="mb-1">Empty Form</span>
                    <span className="text-[9px] opacity-70">Use Inspector to add fields</span>
                </div>
            );
        }

        return (
            <div className="flex flex-col w-full h-full text-xs font-mono">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 select-none flex items-center justify-between">
                    <span>{state.asset.metadata.name || 'Parameters'}</span>
                    <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[9px] font-bold">
                        FORM
                    </span>
                </div>

                <ScrollArea className="flex-1 w-full -mr-2 pr-2">
                    <div className="space-y-1.5 pb-2 pl-5">
                        {schema.map(field => {
                            const val = values[field.key];
                            return <RecipeFieldRow key={field.id} field={field} value={val} />;
                        })}
                    </div>
                </ScrollArea>
            </div>
        );
    };

    return (
        <NodeShell
            selected={selected}
            state={state.executionState as any}
            className={cn(state.shellClassName, 'min-w-[240px]')}
            dockedTop={state.isDockedTop}
            dockedBottom={state.isDockedBottom}
        >
            <NodeResizer
                isVisible={selected && state.isResizable}
                minWidth={240}
                minHeight={150}
                color="#3b82f6"
                handleStyle={{ width: 8, height: 8, borderRadius: 4 }}
                onResizeEnd={(_e, params) => actions.resize(params.width, params.height)}
            />

            <NodePort
                type="target"
                position={Position.Top}
                className="!bg-stone-400"
                isConnectable={!state.isDockedTop}
            />

            <NodeHeader
                className={state.headerClassName}
                icon={<ScrollText className="h-4 w-4" />}
                title={state.title || state.asset?.metadata?.name || 'Recipe'}
                actions={
                    <>
                        <NodeHeaderAction
                            onClick={handleRun}
                            title={!isBound ? 'Bind recipe to run' : 'Run'}
                            className={!isBound ? 'opacity-50' : ''}
                        >
                            {isRunning ? <CirclePause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </NodeHeaderAction>
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
                    {renderContent()}
                </div>
            )}

            {/* Right: Reference (Data Context) -> Yellow */}
            <NodePort type="source" position={Position.Right} id="reference" className="!bg-yellow-400" />

            {/* Bottom: Product (Execution Result) -> Purple */}
            <NodePort
                type="source"
                position={Position.Bottom}
                id="product"
                className="!bg-purple-500"
                isConnectable={!state.isDockedBottom}
            />
        </NodeShell>
    );
});
RecipeNode.displayName = 'RecipeNode';
