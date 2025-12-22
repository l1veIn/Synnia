import { memo } from 'react';
import { NodeProps, Position, NodeResizer } from '@xyflow/react';
import { SynniaNode, NodeType } from '@/types/project';
import { NodeShell } from '../primitives/NodeShell';
import { NodeHeader, NodeHeaderAction } from '../primitives/NodeHeader';
import { NodePort } from '../primitives/NodePort';
import { useNode } from '@/hooks/useNode';
import { Braces, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { FormAssetContent, FieldDefinition } from '@/types/assets';
import { cn } from '@/lib/utils';
import { StandardAssetBehavior } from '@/lib/behaviors/StandardBehavior';
import { FormNodeInspector } from './Inspector';
import { useWorkflowStore } from '@/store/workflowStore';
import { RecipeFieldRow } from '@/components/workflow/widgets';
import type { NodeDefinition } from '@/lib/nodes/NodeRegistry';

// --- Main Node ---
export const FormNode = memo((props: NodeProps<SynniaNode>) => {
    const { id, selected } = props;
    const { state, actions } = useNode(id);

    const renderContent = () => {
        if (!state.asset) return <div className="text-destructive text-xs">Asset Missing</div>;

        const content = state.asset.value as FormAssetContent;

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

        // Filter fields that have handles (for collapsed view)
        const fieldsWithHandles = schema.filter((field: FieldDefinition) => {
            const conn = field.connection;
            return conn?.input === true ||
                (typeof conn?.input === 'object' && conn.input.enabled) ||
                conn?.output === true ||
                (typeof conn?.output === 'object' && conn.output.enabled) ||
                field.widget === 'json-input' ||
                field.type === 'object';
        });

        // When collapsed, only show fields with handles
        const fieldsToShow = state.isCollapsed ? fieldsWithHandles : schema;

        if (fieldsToShow.length === 0) {
            if (state.isCollapsed) {
                return null; // No handle fields to show when collapsed
            }
            return (
                <div className="flex flex-col w-full h-full text-xs items-center justify-center text-muted-foreground italic">
                    <span className="mb-1">No Fields</span>
                </div>
            );
        }

        return (
            <div className="flex flex-col w-full h-full text-xs font-mono">
                {!state.isCollapsed && (
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 select-none flex items-center justify-between px-3">
                        <span>{state.asset.sys?.name || 'JSON Data'}</span>
                        <span className="bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded text-[9px] font-bold">
                            Form
                        </span>
                    </div>
                )}

                <div className="flex-1 w-full overflow-y-auto">
                    <div className={cn("space-y-1.5 pb-2 px-5", state.isCollapsed && "py-1")}>
                        {fieldsToShow.map((field: FieldDefinition) => {
                            const val = values?.[field.key];
                            return <RecipeFieldRow key={field.id} field={field} value={val} />;
                        })}
                    </div>
                </div>
            </div>
        );
    };

    // Check if there are fields with handles (for header border logic)
    const content = state.asset?.value as FormAssetContent | undefined;
    const hasHandleFields = content?.schema?.some((field: FieldDefinition) => {
        const conn = field.connection;
        return conn?.input || conn?.output || field.widget === 'json-input' || field.type === 'object';
    }) ?? false;

    // Check if this node is being previewed as dock target
    const dockPreviewId = useWorkflowStore(s => s.dockPreviewId);
    const isDockPreview = dockPreviewId === id;

    return (
        <NodeShell
            selected={selected}
            state={state.executionState as any}
            className={cn(
                state.shellClassName,
                'min-w-[200px]',
                isDockPreview && "ring-2 ring-purple-500 ring-offset-2 ring-offset-background shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-all duration-150"
            )}
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

            {/* Origin Handle - shown when this is a recipe product */}
            <NodePort.Origin show={state.hasProductHandle} />

            <NodeHeader
                className={cn(
                    state.headerClassName,
                    state.isCollapsed && hasHandleFields && "border-b"
                )}
                icon={<Braces className="h-4 w-4" />}
                title={state.title || state.asset?.sys?.name || 'JSON'}
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

            {/* Show content when expanded OR when collapsed but has handle fields */}
            {(!state.isCollapsed || hasHandleFields) && (
                <div className={cn(
                    "p-3 flex-1 flex flex-col overflow-hidden",
                    state.isCollapsed ? "min-h-0" : "min-h-[40px]"
                )}>
                    {renderContent()}
                </div>
            )}

            {/* Output: Data (Right) */}
            <NodePort.Output />

            {/* Array Output: Only show at tail of docked chain */}
            {state.isDockedTop && !state.isDockedBottom && (
                <NodePort
                    type="source"
                    position={Position.Bottom}
                    id="array"
                    className="bg-green-500"
                    title="Array: Collect all docked nodes above"
                />
            )}
        </NodeShell>
    );
});
FormNode.displayName = 'FormNode';

// --- Node Definition (unified registration) ---
export const definition: NodeDefinition = {
    type: NodeType.FORM,
    component: FormNode,
    inspector: FormNodeInspector,
    config: {
        type: NodeType.FORM,
        title: 'Form',
        category: 'Asset',
        icon: Braces,
        description: 'Form data with custom schema',

        createNodeAlias: 'form',

        defaultStyle: { width: 250, height: 200 },

        createDefaultAsset: () => ({
            valueType: 'record' as const,
            value: {
                schema: [],
                values: {}
            } as FormAssetContent,
        }),
    },
    behavior: StandardAssetBehavior,
    ports: {
        static: [
            {
                id: 'output',
                direction: 'output',
                dataType: 'json',
                label: 'JSON Output',
                resolver: (node, asset) => {
                    if (!asset) return null;
                    const content = asset.value as FormAssetContent;
                    return {
                        type: 'json',
                        value: content?.values || {},
                        meta: { nodeId: node.id, portId: 'output' }
                    };
                }
            },
            {
                id: 'array',
                direction: 'output',
                dataType: 'array',
                label: 'Array Output',
                semantic: true,
                resolver: (node, asset) => {
                    const store = useWorkflowStore.getState();
                    const chain: any[] = [];

                    let currentId: string | null = node.id;
                    while (currentId) {
                        const currentNode = store.nodes.find(n => n.id === currentId);
                        if (!currentNode) break;

                        const nodeAsset = currentNode.data.assetId
                            ? store.assets[currentNode.data.assetId]
                            : undefined;

                        if (nodeAsset) {
                            const content = nodeAsset.value as FormAssetContent;
                            if (content?.values) {
                                chain.unshift(content.values);
                            }
                        }

                        currentId = currentNode.data.dockedTo as string | null;
                    }

                    return {
                        type: 'array',
                        value: chain,
                        meta: { nodeId: node.id, portId: 'array' }
                    };
                }
            }
        ]
    },
};

// Legacy exports for compatibility
export { FormNode as Node, FormNodeInspector as Inspector };
export const config = definition.config;
export const behavior = definition.behavior;

