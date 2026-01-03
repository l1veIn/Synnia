// TableInput Widget
// Visual display for array input fields with schema-based validation
// Used when field.type === 'array' with connection input

import { Link2, Check, AlertCircle, Table2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetDefinition, WidgetProps, FieldRowProps } from '../lib/types';
import { NodePort } from '@/components/workflow/nodes/primitives/NodePort';
import { graphEngine } from '@core/engine/GraphEngine';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// ============================================================================
// Inspector Component (render)
// ============================================================================

function InspectorComponent({ value, field }: WidgetProps) {
    // Get schema from field definition (describes array item structure)
    const schema = field?.schema || [];
    const isConnected = value !== undefined && value !== null;
    const connectedValue = isConnected && Array.isArray(value) ? value : null;
    const rowCount = connectedValue?.length || 0;

    // Sample first item to check schema compatibility
    const firstItem = connectedValue?.[0];
    const hasValidStructure = firstItem && typeof firstItem === 'object';

    // Validate first item against schema
    const validationStatus = schema.map((f) => {
        const hasValue = hasValidStructure &&
            firstItem[f.key] !== undefined &&
            firstItem[f.key] !== null;
        return { key: f.key, label: f.label, hasValue, required: f.required };
    });

    const requiredFields = validationStatus.filter(s => s.required);
    const allValid = rowCount > 0 && (requiredFields.length === 0 || requiredFields.every(s => s.hasValue));

    // Create node handler
    const handleCreateNode = () => {
        if (!schema || schema.length === 0) return;
        const newNodeId = graphEngine.mutator.createNodeFromSchema('table', schema, {
            title: field?.label || 'New Table',
        });
        if (newNodeId) {
            toast.success('Table node created');
        }
    };

    // If connected, show connection status with validation
    if (isConnected && connectedValue) {
        return (
            <div className="w-full rounded-lg border p-3 space-y-2 bg-muted/20">
                {/* Connection Status */}
                <div className="flex items-center gap-2">
                    <div className={cn(
                        "flex items-center justify-center w-6 h-6 rounded-full",
                        allValid ? "bg-green-500/10" : "bg-yellow-500/10"
                    )}>
                        {allValid ? (
                            <Check className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                            <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className={cn(
                            "text-xs font-medium",
                            allValid ? "text-green-600" : "text-yellow-600"
                        )}>
                            Array Connected
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                            {rowCount} row{rowCount !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>

                {/* Schema Fields Preview (from first item) */}
                {schema.length > 0 && hasValidStructure && (
                    <div className="flex flex-wrap gap-1.5">
                        {validationStatus.map(({ key, label, hasValue }) => (
                            <span
                                key={key}
                                className={cn(
                                    "inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono",
                                    hasValue
                                        ? "bg-green-500/10 text-green-600 border border-green-500/20"
                                        : "bg-muted text-muted-foreground border border-transparent"
                                )}
                            >
                                {hasValue && <Check className="h-3 w-3" />}
                                {label || key}
                            </span>
                        ))}
                    </div>
                )}

                {/* Data Preview */}
                {rowCount > 0 && rowCount <= 5 && (
                    <div className="space-y-1 pt-1 border-t border-border/50">
                        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Preview</p>
                        <div className="space-y-0.5 text-[10px] font-mono text-muted-foreground max-h-20 overflow-y-auto">
                            {connectedValue.slice(0, 3).map((item, i) => (
                                <div key={i} className="truncate bg-muted/50 px-1.5 py-0.5 rounded">
                                    {JSON.stringify(item).slice(0, 60)}...
                                </div>
                            ))}
                            {rowCount > 3 && (
                                <div className="text-muted-foreground/50 italic">
                                    ...and {rowCount - 3} more
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Not connected - show placeholder with expected schema and create button
    return (
        <div className="w-full rounded-lg border-2 border-dashed border-muted-foreground/20 p-3 space-y-2 bg-muted/10">
            {/* Placeholder */}
            <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500/10">
                    <Table2 className="h-3.5 w-3.5 text-green-500" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">Array Input</p>
                    <p className="text-[10px] text-muted-foreground/60">Connect a Table/Selector node</p>
                </div>
            </div>

            {/* Create Node Button */}
            {schema.length > 0 && (
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-7 text-xs"
                    onClick={handleCreateNode}
                >
                    <Plus className="h-3 w-3 mr-1" />
                    Create Table Node
                </Button>
            )}

            {/* Expected Schema Preview */}
            {schema.length > 0 && (
                <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Item Schema</p>
                    <div className="flex flex-wrap gap-1">
                        {schema.map((f) => (
                            <span
                                key={f.key}
                                className={cn(
                                    "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono",
                                    f.required
                                        ? "bg-orange-500/10 text-orange-600 border border-orange-500/20"
                                        : "bg-muted text-muted-foreground"
                                )}
                            >
                                {f.label || f.key}
                                {f.required && <span className="ml-0.5 text-orange-500">*</span>}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// FieldRow Renderer (for Node Body)
// ============================================================================

function renderFieldRow({ field, value, isConnected }: FieldRowProps) {
    const schema = field.schema || [];
    const connectedValue = isConnected && Array.isArray(value) ? value : null;
    const rowCount = connectedValue?.length || 0;

    return (
        <div className={cn(
            "relative flex items-center gap-3 py-1.5 px-2 rounded-md transition-colors",
            "bg-background/50 hover:bg-background/80 border border-transparent",
            isConnected && "border-green-500/30 bg-green-500/5"
        )}>
            <NodePort.Input id={field.key} connected={isConnected} />

            <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-1.5 shrink-0">
                    <Table2 className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[11px] font-medium truncate max-w-[70px] text-muted-foreground">
                        {field.label || field.key}
                    </span>
                </div>

                <div className="flex items-center gap-1.5">
                    {isConnected ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-green-500 font-medium bg-green-500/10 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            {rowCount} rows
                        </span>
                    ) : schema.length > 0 ? (
                        <span className="text-[10px] text-muted-foreground/50 italic">
                            {schema.length} columns
                        </span>
                    ) : (
                        <span className="text-[10px] text-muted-foreground/50 italic">array</span>
                    )}
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// Widget Definition Export
// ============================================================================

export const TableInputWidget: WidgetDefinition = {
    id: 'table-input',
    render: (props) => <InspectorComponent {...props} />,
    renderFieldRow,
    getInputHandles: () => [{ id: 'data', dataType: 'json', label: 'Array Data' }],
};
