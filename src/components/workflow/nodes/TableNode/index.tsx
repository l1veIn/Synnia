import { memo, useEffect, useMemo, useState } from 'react';
import { NodeProps, NodeResizer, useUpdateNodeInternals } from '@xyflow/react';
import { SynniaNode } from '@/types/project';
import { NodeShell } from '../primitives/NodeShell';
import { NodeHeader, NodeHeaderAction } from '../primitives/NodeHeader';
import { NodePort } from '../primitives/NodePort';
import { useNode } from '@/hooks/useNode';
import { Table as TableIcon, Trash2, ChevronDown, ChevronUp, Edit } from 'lucide-react';
import { DataEditorDialog } from '@/components/data-editor/DataEditorDialog';
import { toast } from 'sonner';
import { getWidget } from '@/components/workflow/widgets';
import { cn } from '@/lib/utils';

import { FieldDefinition } from '@/types/assets';

// --- Asset Content Type ---
export interface TableColumn {
    key: string;
    label: string;
    type: string;
    width?: number;
    widget?: string;
    config?: any;
}

export interface TableAssetContent {
    columns: TableColumn[];
    rows: Record<string, any>[];
    schema?: FieldDefinition[]; // Add schema support
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

    // Get content with defaults
    // V2 architecture: rows in asset.value, schema in asset.config.schema
    const content: TableAssetContent = useMemo(() => {
        const config = (state.asset?.config as any) || {};
        const rawValue = state.asset?.value;

        // Handle value: can be array (rows) or object with rows property
        let rows: Record<string, any>[] = [];
        if (Array.isArray(rawValue)) {
            rows = rawValue;
        } else if (rawValue && typeof rawValue === 'object' && Array.isArray((rawValue as any).rows)) {
            rows = (rawValue as any).rows;
        }

        // Read from schema (new) or columns (legacy)
        // Convert FieldDefinition[] to TableColumn[] if needed
        let columns: TableColumn[] = [];
        if (config.schema && Array.isArray(config.schema)) {
            columns = config.schema.map((f: any) => ({
                key: f.key,
                label: f.label || f.key,
                type: f.type,
                width: f.config?.width,
                widget: f.widget,
                config: f.config,
            }));
        } else if (config.columns && Array.isArray(config.columns)) {
            columns = config.columns;
        }

        return {
            columns,
            rows,
            schema: config.schema,
            showRowNumbers: config.showRowNumbers ?? true,
            allowAddRow: config.allowAddRow ?? true,
            allowDeleteRow: config.allowDeleteRow ?? true,
        };
    }, [state.asset?.value, state.asset?.config]);

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
                                                        <TableCellValue field={col} value={row[col.key]} />
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
            <DataEditorDialog
                open={isEditorOpen}
                onOpenChange={setIsEditorOpen}
                data={content.rows}
                schema={content.schema || []}
                onSave={(newData) => {
                    actions.updateContent(newData);
                    toast.success('Table updated');
                }}
                title={`Edit ${state.title}`}
            />
        </NodeShell>
    );
});
TableNode.displayName = 'TableNode';

// --- Internal Cell Renderer ---
// Uses widget's renderFieldContent for consistent value display
function TableCellValue({ field, value }: { field: TableColumn, value: any }) {
    // 1. Try Widget's renderFieldContent (preferred)
    if (field.widget) {
        const widgetDef = getWidget(field.widget);
        if (widgetDef?.renderFieldContent) {
            // Create a minimal FieldContentProps for table cell context
            const contentProps = {
                field: field as FieldDefinition,
                value,
                onChange: () => { }, // Read-only
                disabled: true,
                isConnected: false, // Table cells are never "connected"
                connectedValues: {},
            };
            return (
                <div className="flex items-center gap-1">
                    {widgetDef.renderFieldContent(contentProps)}
                </div>
            );
        }
    }

    // 2. Smart Formatting (Fallback)
    if (value === undefined || value === null) {
        return <span className="text-muted-foreground/30">-</span>;
    }

    if (field.type === 'boolean') {
        return value ? (
            <span className="text-green-600 font-bold text-[10px]">TRUE</span>
        ) : (
            <span className="text-muted-foreground font-bold text-[10px]">FALSE</span>
        );
    }

    if (typeof value === 'object') {
        const label = Array.isArray(value) ? `Array[${value.length}]` : 'Object';
        return (
            <span className="text-[10px] bg-muted px-1 rounded text-muted-foreground whitespace-nowrap">
                {label}
            </span>
        );
    }

    return (
        <span className="truncate block max-w-[150px]" title={String(value)}>
            {String(value)}
        </span>
    );
}

export { Inspector } from './Inspector';
export { definition } from './definition';
export { TableNode as Node };

