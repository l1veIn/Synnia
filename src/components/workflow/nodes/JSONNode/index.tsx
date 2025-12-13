import { memo } from 'react';
import { NodeProps, Position, NodeResizer, useNodeConnections } from '@xyflow/react';
import { SynniaNode, NodeType } from '@/types/project';
import { NodeShell } from '../primitives/NodeShell';
import { NodeHeader, NodeHeaderAction } from '../primitives/NodeHeader';
import { NodePort } from '../primitives/NodePort';
import { useNode } from '@/hooks/useNode';
import { Braces, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { FormAssetContent, FieldDefinition } from '@/types/assets';
import { cn } from '@/lib/utils';
import { NodeConfig, NodeOutputConfig } from '@/types/node-config';
import { StandardAssetBehavior } from '@/lib/behaviors/StandardBehavior';
import { JSONNodeInspector } from './Inspector';

// --- Output Resolvers ---
export const outputs: NodeOutputConfig = {
    'data': (node, asset) => {
        if (!asset) return null;
        const content = asset.content as FormAssetContent;
        return { type: 'json', value: content?.values || {} };
    }
};

// --- Configuration ---
export const config: NodeConfig = {
    type: NodeType.JSON,
    title: 'JSON',
    category: 'Asset',
    icon: Braces,
    description: 'Custom JSON data with schema',
};

// --- Behavior ---
export const behavior = StandardAssetBehavior;

export { JSONNode as Node, JSONNodeInspector as Inspector };

// --- Field Row with Connection Support ---
const JSONFieldRow = ({
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

    // Determine if handles should be shown
    const conn = field.connection;
    const hasInputHandle = conn?.input === true ||
        (typeof conn?.input === 'object' && conn.input.enabled) ||
        field.widget === 'node-input' ||
        field.type === 'object' ||
        conn?.enabled;
    const hasOutputHandle = conn?.output === true ||
        (typeof conn?.output === 'object' && conn.output.enabled);

    const displayValue = value === undefined || value === '' || value === null
        ? <span className="text-muted-foreground/50">-</span>
        : typeof value === 'object'
            ? <span className="text-blue-500 text-[10px]">{JSON.stringify(value).slice(0, 30)}...</span>
            : String(value);

    return (
        <div className="relative flex items-center justify-between gap-2 min-h-[20px]">
            {/* Input Handle (Left - Blue) */}
            {hasInputHandle && (
                <NodePort
                    type="target"
                    position={Position.Left}
                    id={field.key}
                    className="!bg-blue-500"
                />
            )}

            <span
                className="shrink-0 max-w-[80px] truncate text-muted-foreground"
                title={field.label || field.key}
            >
                {field.label || field.key}:
            </span>

            {isConnected ? (
                <span className="text-blue-500 text-[10px] italic font-medium bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                    Linked
                </span>
            ) : (
                <span
                    className="text-foreground truncate font-medium bg-muted/50 px-1.5 py-0.5 rounded max-w-[120px]"
                    title={String(value)}
                >
                    {displayValue}
                </span>
            )}

            {/* Output Handle (Right - Green) */}
            {hasOutputHandle && (
                <NodePort
                    type="source"
                    position={Position.Right}
                    id={typeof conn?.output === 'object' && conn.output.handleId ? conn.output.handleId : `field:${field.key}`}
                    className="!bg-green-500"
                />
            )}
        </div>
    );
};

// --- Main Node ---
export const JSONNode = memo((props: NodeProps<SynniaNode>) => {
    const { id, selected } = props;
    const { state, actions } = useNode(id);

    const renderContent = () => {
        if (!state.asset) return <div className="text-destructive text-xs">Asset Missing</div>;

        const content = state.asset.content as FormAssetContent;

        // Check if it's a proper form asset
        if (!content || !Array.isArray(content.schema)) {
            return (
                <div className="flex flex-col w-full h-full text-xs items-center justify-center text-muted-foreground italic">
                    <span className="mb-1">Empty JSON</span>
                    <span className="text-[9px] opacity-70">Use Inspector to add fields</span>
                </div>
            );
        }

        const { schema, values } = content;

        if (schema.length === 0) {
            return (
                <div className="flex flex-col w-full h-full text-xs items-center justify-center text-muted-foreground italic">
                    <span className="mb-1">No Fields</span>
                    <span className="text-[9px] opacity-70">Use Inspector to define schema</span>
                </div>
            );
        }

        return (
            <div className="flex flex-col w-full h-full text-xs font-mono">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 select-none flex items-center justify-between px-3">
                    <span>{state.asset.metadata.name || 'JSON Data'}</span>
                    <span className="bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded text-[9px] font-bold">
                        JSON
                    </span>
                </div>

                <div className="flex-1 w-full overflow-y-auto">
                    <div className="space-y-1.5 pb-2 px-5">
                        {schema.map(field => {
                            const val = values?.[field.key];
                            return <JSONFieldRow key={field.id} field={field} value={val} />;
                        })}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <NodeShell
            selected={selected}
            state={state.executionState as any}
            className={cn(state.shellClassName, 'min-w-[200px]')}
            dockedTop={state.isDockedTop}
            dockedBottom={state.isDockedBottom}
        >
            <NodeResizer
                isVisible={selected && state.isResizable}
                minWidth={200}
                minHeight={120}
                color="#3b82f6"
                handleStyle={{ width: 8, height: 8, borderRadius: 4 }}
                onResizeEnd={(_e, params) => actions.resize(params.width, params.height)}
            />

            <NodePort
                type="target"
                position={Position.Top}
                id="input"
                className="!bg-stone-400"
                isConnectable={!state.isDockedTop}
            />

            <NodeHeader
                className={state.headerClassName}
                icon={<Braces className="h-4 w-4" />}
                title={state.title || state.asset?.metadata?.name || 'JSON'}
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
                    {renderContent()}
                </div>
            )}

            {/* Output: Data (Right, Yellow) */}
            <NodePort
                type="source"
                position={Position.Right}
                id="data"
                className="!bg-yellow-400"
            />
        </NodeShell>
    );
});
JSONNode.displayName = 'JSONNode';
