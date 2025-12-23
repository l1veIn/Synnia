import { memo, useMemo, useState, useEffect, useRef } from 'react';
import { NodeProps, NodeResizer } from '@xyflow/react';
import { SynniaNode, NodeType } from '@/types/project';
import { NodeShell } from '../primitives/NodeShell';
import { NodeHeader, NodeHeaderAction } from '../primitives/NodeHeader';
import { NodePort } from '../primitives/NodePort';
import { useNode } from '@/hooks/useNode';
import { useRunRecipe } from '@/hooks/useRunRecipe';
import { Play, Trash2, ScrollText, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { RecipeNodeInspector } from './Inspector';
import { StandardAssetBehavior } from '@/lib/behaviors/StandardBehavior';
import { getResolvedRecipe } from '@/lib/recipes';
import { portRegistry } from '@/lib/engine/ports';
import { RecipeFormRenderer } from '@/components/workflow/widgets';

// --- Register Ports ---
portRegistry.register(NodeType.RECIPE, {
    static: [
        {
            id: 'reference',
            direction: 'output',
            dataType: 'json',
            label: 'Reference Output',
            resolver: (node, asset) => {
                if (asset?.value && typeof asset.value === 'object') {
                    const content = asset.value as any;
                    if (content.values) {
                        return {
                            type: 'json',
                            value: content.values,
                            meta: { nodeId: node.id, portId: 'reference' }
                        };
                    }
                }
                return { type: 'json', value: {}, meta: { nodeId: node.id, portId: 'reference' } };
            }
        }
    ]
});

// --- Behavior ---
export const behavior = StandardAssetBehavior;

// Note: RecipeNodes are registered dynamically in nodes/index.ts for each recipe
export { RecipeNode as Node, RecipeNodeInspector as Inspector };

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

    // Get values from asset - now from asset.value
    const assetValues = useMemo(() => {
        if (state.asset?.value && typeof state.asset.value === 'object') {
            const content = state.asset.value as any;
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

        // Check if there are any visible fields
        const visibleFields = recipe.inputSchema.filter(field => !field.hidden);
        if (visibleFields.length === 0) {
            if (state.isCollapsed) {
                return null;
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
                    <div className={cn("pb-2 px-5", state.isCollapsed && "py-1")}>
                        <RecipeFormRenderer
                            fields={recipe.inputSchema}
                            values={values}
                            isCollapsed={state.isCollapsed}
                        />
                    </div>
                </div>
            </div>
        );
    };

    const IconComponent = recipe?.icon || ScrollText;

    // Check if there are fields with handles (to know if we need content area even when collapsed)
    const hasHandleFields = recipe?.inputSchema.some(field => {
        const conn = field.connection;
        return conn?.input || conn?.output || field.widget === 'json-input' || field.type === 'object';
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

            {/* Origin Handle - shown when this is a recipe product */}
            <NodePort.Origin show={state.hasProductHandle} />

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

            <NodePort.Output id="reference" />

            <NodePort.Product />
        </NodeShell>
    );
});
RecipeNode.displayName = 'RecipeNode';
