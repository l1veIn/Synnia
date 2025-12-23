import { memo, useEffect, useMemo, useState } from 'react';
import { NodeProps, NodeResizer, useUpdateNodeInternals } from '@xyflow/react';
import { SynniaNode, NodeType } from '@/types/project';
import { NodeShell } from '../primitives/NodeShell';
import { NodeHeader, NodeHeaderAction } from '../primitives/NodeHeader';
import { NodePort } from '../primitives/NodePort';
import { useNode } from '@/hooks/useNode';
import { Table as TableIcon, Trash2, ChevronDown, ChevronUp, Edit } from 'lucide-react';
import { StandardAssetBehavior } from '@core/registry/StandardBehavior';
import { Inspector } from './Inspector';
import { TableEditor } from './TableEditor';
import { cn } from '@/lib/utils';
import type { NodeDefinition } from '@core/registry/NodeRegistry';

// --- Asset Content Type ---
export interface TableColumn {
    key: string;
    label: string;
    type: 'string' | 'number' | 'boolean';
    width?: number;
}

export interface TableAssetContent {
    columns: TableColumn[];
    rows: Record<string, any>[];
    showRowNumbers: boolean;
    allowAddRow: boolean;
    allowDeleteRow: boolean;
}

// --- Node Component ---
export const TableNode = memo((props: NodeProps<SynniaNode>) => {
    const { id, selected } = props;
    const { state, actions } = useNode(id);
    const updateNodeInternals = useUpdateNodeInternals();
    const [isEditorOpen, setIsEditorOpen] = useState(false);

    useEffect(() => {
        updateNodeInternals(id);
    }, [state.isCollapsed, id, updateNodeInternals]);

    // Get content with defaults - now from asset.value
    const content: TableAssetContent = useMemo(() => {
        const raw = (state.asset?.value as TableAssetContent) || {};
        return {
            columns: raw.columns ?? [],
            rows: raw.rows ?? [],
            showRowNumbers: raw.showRowNumbers ?? true,
            allowAddRow: raw.allowAddRow ?? true,
            allowDeleteRow: raw.allowDeleteRow ?? true,
        };
    }, [state.asset?.value]);

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
                minWidth={250}
                minHeight={150}
                color="#3b82f6"
                handleStyle={{ width: 8, height: 8, borderRadius: 4 }}
                onResizeEnd={(_e, params) => actions.resize(params.width, params.height)}
            />

            {/* Origin Handle - shown when this is a recipe product */}
            <NodePort.Origin show={state.hasProductHandle} />

            <NodeHeader
                className={state.headerClassName}
                icon={<TableIcon className="h-4 w-4" />}
                title={state.title}
                actions={
                    <>
                        <NodeHeaderAction
                            onClick={() => setIsEditorOpen(true)}
                            title="Edit Table"
                        >
                            <Edit className="h-4 w-4" />
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
                <div className="p-2 flex-1 flex flex-col overflow-hidden">
                    {content.columns.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                            No columns. Click Edit to configure.
                        </div>
                    ) : (
                        <div className="flex-1 min-h-0 overflow-auto">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="border-b bg-muted/50">
                                        {content.showRowNumbers && (
                                            <th className="px-2 py-1 text-left text-muted-foreground w-8">#</th>
                                        )}
                                        {content.columns.map(col => (
                                            <th
                                                key={col.key}
                                                className="px-2 py-1 text-left font-medium"
                                                style={{ width: col.width }}
                                            >
                                                {col.label || col.key}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {content.rows.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={content.columns.length + (content.showRowNumbers ? 1 : 0)}
                                                className="text-center py-4 text-muted-foreground"
                                            >
                                                No rows
                                            </td>
                                        </tr>
                                    ) : (
                                        content.rows.map((row, rowIdx) => (
                                            <tr key={rowIdx} className="border-b hover:bg-muted/30">
                                                {content.showRowNumbers && (
                                                    <td className="px-2 py-1 text-muted-foreground">{rowIdx + 1}</td>
                                                )}
                                                {content.columns.map(col => (
                                                    <td key={col.key} className="px-2 py-1">
                                                        <span className="truncate block max-w-[100px]">
                                                            {row[col.key] ?? '-'}
                                                        </span>
                                                    </td>
                                                ))}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Collapsed preview */}
            {state.isCollapsed && (
                <div className="px-3 pb-2 text-xs text-muted-foreground">
                    {content.rows.length} rows × {content.columns.length} cols
                </div>
            )}

            <NodePort.Output disabled={state.isDockedBottom} />

            {/* Editor Dialog */}
            <TableEditor
                open={isEditorOpen}
                onOpenChange={setIsEditorOpen}
                assetId={state.asset?.id}
            />
        </NodeShell>
    );
});
TableNode.displayName = 'TableNode';

// Re-export from separate files
export { Inspector } from './Inspector';
export { definition } from './definition';
export { TableNode as Node };

