import { memo, useEffect, useMemo } from 'react';
import { NodeProps, NodeResizer, useUpdateNodeInternals } from '@xyflow/react';
import { SynniaNode, NodeType } from '@/types/project';
import { NodeShell } from '../primitives/NodeShell';
import { NodeHeader, NodeHeaderAction } from '../primitives/NodeHeader';
import { NodePort } from '../primitives/NodePort';
import { useNode } from '@/hooks/useNode';
import { ListTodo, Trash2, ChevronDown, ChevronUp, Play, Pause, RotateCcw, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NodeConfig, NodeOutputConfig } from '@/types/node-config';
import { StandardAssetBehavior } from '@/lib/behaviors/StandardBehavior';
import { Inspector } from './Inspector';
import { cn } from '@/lib/utils';

// --- Asset Content Type ---
export type TaskStatus = 'pending' | 'running' | 'success' | 'error';

export interface QueueTask {
    id: string;
    name: string;
    status: TaskStatus;
    result?: any;
    error?: string;
    duration?: number;
}

export interface QueueAssetContent {
    concurrency: number;
    autoStart: boolean;
    retryOnError: boolean;
    retryCount: number;
    continueOnError: boolean;
    tasks: QueueTask[];
    isRunning: boolean;
}

// --- Output Resolvers ---
export const outputs: NodeOutputConfig = {
    output: (node, asset) => {
        if (!asset?.content) return null;
        const content = asset.content as QueueAssetContent;
        return {
            type: 'array',
            value: content.tasks
                .filter(t => t.status === 'success')
                .map(t => t.result)
        };
    }
};

// --- Configuration ---
export const config: NodeConfig = {
    type: NodeType.QUEUE,
    title: 'Queue',
    category: 'Process',
    icon: ListTodo,
    description: 'Task queue management',
    defaultWidth: 300,
    defaultHeight: 280,
};

export const behavior = StandardAssetBehavior;

// Status icon component
const StatusIcon = ({ status }: { status: TaskStatus }) => {
    switch (status) {
        case 'pending': return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
        case 'running': return <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />;
        case 'success': return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
        case 'error': return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    }
};

// --- Node Component ---
export const QueueNode = memo((props: NodeProps<SynniaNode>) => {
    const { id, selected } = props;
    const { state, actions } = useNode(id);
    const updateNodeInternals = useUpdateNodeInternals();

    useEffect(() => {
        updateNodeInternals(id);
    }, [state.isCollapsed, id, updateNodeInternals]);

    // Get content with defaults
    const content: QueueAssetContent = useMemo(() => {
        const raw = (state.asset?.content as QueueAssetContent) || {};
        return {
            concurrency: raw.concurrency ?? 1,
            autoStart: raw.autoStart ?? false,
            retryOnError: raw.retryOnError ?? true,
            retryCount: raw.retryCount ?? 3,
            continueOnError: raw.continueOnError ?? false,
            tasks: raw.tasks ?? [],
            isRunning: raw.isRunning ?? false,
        };
    }, [state.asset?.content]);

    // Stats
    const completedCount = content.tasks.filter(t => t.status === 'success').length;
    const errorCount = content.tasks.filter(t => t.status === 'error').length;
    const pendingCount = content.tasks.filter(t => t.status === 'pending').length;
    const runningCount = content.tasks.filter(t => t.status === 'running').length;

    // Toggle running state (demo behavior - actual implementation would need execution logic)
    const toggleRunning = () => {
        if (state.isReference) return;
        actions.updateContent({
            ...content,
            isRunning: !content.isRunning
        });
    };

    // Reset all tasks
    const resetTasks = () => {
        if (state.isReference) return;
        actions.updateContent({
            ...content,
            isRunning: false,
            tasks: content.tasks.map(t => ({ ...t, status: 'pending' as TaskStatus, result: undefined, error: undefined }))
        });
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
                minWidth={220}
                minHeight={150}
                color="#3b82f6"
                handleStyle={{ width: 8, height: 8, borderRadius: 4 }}
                onResizeEnd={(_e, params) => actions.resize(params.width, params.height)}
            />

            {/* Origin Handle - shown when this is a recipe product */}
            <NodePort.Origin show={state.hasProductHandle} />

            <NodeHeader
                className={state.headerClassName}
                icon={<ListTodo className="h-4 w-4" />}
                title={state.title}
                actions={
                    <>
                        <NodeHeaderAction
                            onClick={toggleRunning}
                            title={content.isRunning ? 'Pause' : 'Start'}
                        >
                            {content.isRunning
                                ? <Pause className="h-4 w-4 text-yellow-500" />
                                : <Play className="h-4 w-4 text-green-500" />
                            }
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
                <div className="p-2 flex-1 flex flex-col overflow-hidden gap-2">
                    {/* Task List */}
                    <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
                        {content.tasks.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                                No tasks. Add in Inspector.
                            </div>
                        ) : (
                            content.tasks.map((task, idx) => (
                                <div
                                    key={task.id}
                                    className={cn(
                                        'flex items-center gap-2 p-2 rounded text-xs',
                                        task.status === 'running' && 'bg-blue-500/10 border border-blue-500/30',
                                        task.status === 'success' && 'bg-green-500/5',
                                        task.status === 'error' && 'bg-red-500/5',
                                        task.status === 'pending' && 'bg-muted/50'
                                    )}
                                >
                                    <span className="text-muted-foreground w-5">{idx + 1}.</span>
                                    <StatusIcon status={task.status} />
                                    <span className="flex-1 truncate">{task.name}</span>
                                    {task.duration && (
                                        <span className="text-[10px] text-muted-foreground">{task.duration}s</span>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between text-xs shrink-0 pt-1 border-t">
                        <span className="text-muted-foreground">
                            {completedCount}/{content.tasks.length}
                            {errorCount > 0 && <span className="text-red-500 ml-1">({errorCount} failed)</span>}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-[10px]"
                            onClick={resetTasks}
                            disabled={content.tasks.length === 0}
                        >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Reset
                        </Button>
                    </div>
                </div>
            )}

            {/* Collapsed preview */}
            {state.isCollapsed && content.tasks.length > 0 && (
                <div className="px-3 pb-2 text-xs text-muted-foreground">
                    {content.isRunning ? '▶ Running' : `${completedCount}/${content.tasks.length}`}
                    {pendingCount > 0 && ` • ${pendingCount} pending`}
                </div>
            )}

            <NodePort.Output disabled={state.isDockedBottom} />
        </NodeShell>
    );
});
QueueNode.displayName = 'QueueNode';

// Standard Exports
export { QueueNode as Node, Inspector };
