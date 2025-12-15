import { memo, useMemo, useState, useEffect, useRef } from 'react';
import { NodeProps, Position, NodeResizer, useNodeConnections } from '@xyflow/react';
import { SynniaNode, NodeType } from '@/types/project';
import { NodeShell } from '../primitives/NodeShell';
import { NodeHeader, NodeHeaderAction } from '../primitives/NodeHeader';
import { NodePort } from '../primitives/NodePort';
import { useNode } from '@/hooks/useNode';
import { useRunRecipe } from '@/hooks/useRunRecipe';
import { Play, CirclePause, Trash2, ScrollText, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { FieldDefinition } from '@/types/assets';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { RecipeNodeInspector } from './Inspector';
import { NodeConfig, NodeOutputConfig } from '@/types/node-config';
import { HANDLE_IDS } from '@/types/handles';
import { StandardAssetBehavior } from '@/lib/behaviors/StandardBehavior';
import { getResolvedRecipe } from '@/lib/recipes';

// --- Output Resolvers ---
export const outputs: NodeOutputConfig = {
    'product': (node) => {
        const result = (node.data as any).executionResult;
        if (!result) return null;
        return { type: 'json', value: result };
    },

    'reference': (node, asset) => {
        // Get values from asset (FormAssetContent)
        if (asset?.content && typeof asset.content === 'object') {
            const content = asset.content as any;
            if (content.values) {
                return { type: 'json', value: content.values };
            }
        }
        return { type: 'json', value: {} };
    }
};

// --- Configuration ---
export const config: NodeConfig = {
    type: NodeType.RECIPE,
    title: 'Recipe',
    category: 'Process',
    icon: Play,
    description: 'Processing unit',
    hidden: true, // Hide generic recipe, recipes show individually
};

// --- Behavior ---
export const behavior = StandardAssetBehavior;

export { RecipeNode as Node, RecipeNodeInspector as Inspector };

// --- Field Row ---
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
    const isMissing = field.rules?.required && (value === undefined || value === '' || value === null);
    const isDisabled = field.disabled === true;

    // Determine if handles should be shown
    const conn = field.connection;
    const hasInputHandle = conn?.input === true ||
        (typeof conn?.input === 'object' && conn.input.enabled) ||
        field.widget === 'node-input' ||
        field.type === 'object' ||
        conn?.enabled;
    const hasOutputHandle = conn?.output === true ||
        (typeof conn?.output === 'object' && conn.output.enabled);

    // Format display value
    const formatValue = (val: any) => {
        if (val === undefined || val === '' || val === null) return null;
        if (typeof val === 'boolean') return val ? 'Yes' : 'No';
        if (typeof val === 'object') return JSON.stringify(val).slice(0, 20) + '...';
        const str = String(val);
        return str.length > 25 ? str.slice(0, 25) + '...' : str;
    };

    const displayValue = formatValue(value);

    return (
        <div className={cn(
            "relative flex items-center gap-3 py-1.5 px-2 rounded-md transition-colors",
            "bg-background/50 hover:bg-background/80 border border-transparent",
            isConnected && "border-blue-500/30 bg-blue-500/5",
            isDisabled && "bg-muted/30 opacity-70",
            isMissing && !isConnected && "border-destructive/40 bg-destructive/5"
        )}>
            {/* Input Handle (Left) */}
            {hasInputHandle && (
                <NodePort
                    type="target"
                    position={Position.Left}
                    id={field.key}
                    className={cn(
                        "!w-3 !h-3 !rounded-full !border-2 !border-background",
                        isConnected ? "!bg-blue-500" : "!bg-muted-foreground/40"
                    )}
                />
            )}

            {/* Field Info */}
            <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
                {/* Label */}
                <div className="flex items-center gap-1.5 shrink-0">
                    {/* {hasInputHandle && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500/60" />
                    )} */}
                    <span className={cn(
                        "text-[11px] font-medium truncate max-w-[70px]",
                        isMissing && !isConnected ? "text-destructive" : "text-muted-foreground"
                    )}>
                        {field.label || field.key}
                    </span>
                </div>

                {/* Value */}
                <div className="flex items-center gap-1.5">
                    {isConnected ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-blue-500 font-medium bg-blue-500/10 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                            linked
                        </span>
                    ) : displayValue ? (
                        <span className={cn(
                            "text-[11px] font-mono px-2 py-0.5 rounded",
                            isDisabled ? "bg-muted/50 text-muted-foreground" : "bg-muted/80 text-foreground"
                        )}>
                            {displayValue}
                        </span>
                    ) : (
                        <span className="text-[10px] text-muted-foreground/50 italic">empty</span>
                    )}

                    {/* {hasOutputHandle && (
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500/60" />
                    )} */}
                </div>
            </div>

            {/* Output Handle (Right) */}
            {hasOutputHandle && (
                <NodePort
                    type="source"
                    position={Position.Right}
                    id={typeof conn?.output === 'object' && conn.output.handleId ? conn.output.handleId : `field:${field.key}`}
                    className="!w-3 !h-3 !rounded-full !border-2 !border-background !bg-green-500"
                />
            )}
        </div>
    );
};

// --- Main Node ---
export const RecipeNode = memo((props: NodeProps<SynniaNode>) => {
    const { id, selected } = props;
    const { state, actions } = useNode(id);
    const { runRecipe } = useRunRecipe();

    const nodeData = state.node?.data as any;
    const recipeId = nodeData?.recipeId;
    const recipe = useMemo(() => recipeId ? getResolvedRecipe(recipeId) : null, [recipeId]);

    const isRunning = state.executionState === 'running';

    // Execution timer
    const [elapsedTime, setElapsedTime] = useState(0);
    const startTimeRef = useRef<number | null>(null);

    useEffect(() => {
        if (isRunning) {
            startTimeRef.current = Date.now();
            setElapsedTime(0);
            const interval = setInterval(() => {
                if (startTimeRef.current) {
                    setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 100) / 10);
                }
            }, 100);
            return () => clearInterval(interval);
        } else {
            startTimeRef.current = null;
        }
    }, [isRunning]);

    // Get values from asset
    const assetValues = useMemo(() => {
        if (state.asset?.content && typeof state.asset.content === 'object') {
            const content = state.asset.content as any;
            return content.values || {};
        }
        return {};
    }, [state.asset]);

    // Get execution result values
    const executionResult = nodeData?.executionResult || {};

    // Merge values: for disabled fields, prefer executionResult
    const values = useMemo(() => {
        if (!recipe) return assetValues;

        const merged = { ...assetValues };
        for (const field of recipe.inputSchema) {
            if (field.disabled && executionResult[field.key] !== undefined) {
                merged[field.key] = executionResult[field.key];
            }
        }
        return merged;
    }, [assetValues, executionResult, recipe]);

    const handleRun = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!recipeId || !recipe) {
            toast.warning('No recipe bound');
            return;
        }
        runRecipe(id, recipeId);
    };

    const renderContent = () => {
        if (!recipe) {
            return <div className="text-destructive text-xs">Recipe not found: {recipeId}</div>;
        }

        // Filter fields that have handles (and are not hidden)
        const fieldsWithHandles = recipe.inputSchema.filter(field => {
            if (field.hidden) return false; // Skip hidden fields
            const conn = field.connection;
            return conn?.input === true ||
                (typeof conn?.input === 'object' && conn.input.enabled) ||
                conn?.output === true ||
                (typeof conn?.output === 'object' && conn.output.enabled) ||
                field.widget === 'node-input' ||
                field.type === 'object';
        });

        // Filter out hidden fields from visible schema
        const visibleSchema = recipe.inputSchema.filter(field => !field.hidden);

        // When collapsed, only show fields with handles
        const fieldsToShow = state.isCollapsed ? fieldsWithHandles : visibleSchema;

        if (fieldsToShow.length === 0) {
            if (state.isCollapsed) {
                return null; // No handle fields to show when collapsed
            }
            return (
                <div className="flex flex-col w-full h-full text-xs items-center justify-center text-muted-foreground italic">
                    <span className="mb-1">No Parameters</span>
                    <span className="text-[9px] opacity-70">This recipe has no inputs</span>
                </div>
            );
        }

        return (
            <div className="flex flex-col w-full h-full text-xs font-mono">
                {!state.isCollapsed && (
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 select-none flex items-center justify-between px-3">
                        <span>{recipe.name}</span>
                        <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[9px] font-bold">
                            {recipe.category || 'RECIPE'}
                        </span>
                    </div>
                )}
                <div className="flex-1 w-full overflow-y-auto">
                    <div className={cn("space-y-1.5 pb-2 px-5", state.isCollapsed && "py-1")}>
                        {fieldsToShow.map(field => (
                            <RecipeFieldRow key={field.id} field={field} value={values[field.key]} />
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const IconComponent = recipe?.icon || ScrollText;

    // Check if there are fields with handles (to know if we need content area even when collapsed)
    const hasHandleFields = recipe?.inputSchema.some(field => {
        const conn = field.connection;
        return conn?.input || conn?.output || field.widget === 'node-input' || field.type === 'object';
    }) ?? false;

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

            {/* Input Handle - only shown when this is a recipe product */}
            {state.hasProductHandle && (
                <NodePort
                    type="target"
                    position={Position.Top}
                    id={HANDLE_IDS.INPUT}
                    className="!bg-violet-500"
                    isConnectable={true}
                />
            )}

            <NodeHeader
                className={cn(
                    state.headerClassName,
                    // Keep border when collapsed but still showing handle fields
                    state.isCollapsed && hasHandleFields && 'border-b'
                )}
                icon={<IconComponent className="h-4 w-4" />}
                title={
                    <div className="flex items-center gap-2">
                        <span>{state.title || recipe?.name || 'Recipe'}</span>
                        {isRunning && (
                            <span className="flex items-center gap-1 text-[10px] text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded-full font-mono">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {elapsedTime.toFixed(1)}s
                            </span>
                        )}
                    </div>
                }
                actions={
                    <>
                        <NodeHeaderAction onClick={handleRun} title={isRunning ? "Running..." : "Run"}>
                            {isRunning ? <Loader2 className="h-4 w-4 animate-spin text-blue-500" /> : <Play className="h-4 w-4" />}
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

            {/* Show content when expanded OR when collapsed but has handle fields */}
            {(!state.isCollapsed || hasHandleFields) && (
                <div className={cn(
                    "p-3 flex-1 flex flex-col overflow-hidden",
                    state.isCollapsed ? "min-h-0" : "min-h-[40px]"
                )}>
                    {renderContent()}
                </div>
            )}

            <NodePort type="source" position={Position.Right} id="reference" className="!bg-green-500" />

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
