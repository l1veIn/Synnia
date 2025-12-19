// FieldRow - Renders input field rows in node body
// Supports widget delegation via renderFieldRow

import { useMemo } from 'react';
import { useNodeConnections } from '@xyflow/react';
import { FieldDefinition } from '@/types/assets';
import { NodePort } from '@/components/workflow/nodes/primitives/NodePort';
import { getWidget, getWidgetInputHandles } from './registry';
import { cn } from '@/lib/utils';
import { FieldRowProps } from './types';

// ============================================================================
// RecipeFieldRow - Individual field row with widget delegation support
// ============================================================================

export interface RecipeFieldRowProps {
    field: FieldDefinition;
    value: any;
    connectedValues?: Record<string, any>;
    onChange?: (value: any) => void;
}

export function RecipeFieldRow({
    field,
    value,
    connectedValues = {},
    onChange,
}: RecipeFieldRowProps) {
    const connections = useNodeConnections({
        handleType: 'target',
        handleId: field.key,
    });
    const isConnected = connections.length > 0;
    const isMissing = field.rules?.required && (value === undefined || value === '' || value === null);
    const isDisabled = field.disabled === true;

    // Check if widget wants to render the entire row
    const widget = field.widget ? getWidget(field.widget) : undefined;

    if (widget?.renderFieldRow) {
        // Widget takes full control
        const fieldRowProps: FieldRowProps = {
            field,
            value,
            onChange: onChange || (() => { }),
            disabled: isDisabled,
            isConnected,
            connectedValues,
        };
        return <>{widget.renderFieldRow(fieldRowProps)}</>;
    }

    // Default rendering (current RecipeNode logic)
    // Determine if handles should be shown
    const conn = field.connection;
    const hasInputHandle = conn?.input === true ||
        (typeof conn?.input === 'object' && conn.input.enabled) ||
        field.widget === 'json-input' ||
        field.type === 'object' ||
        conn?.enabled;
    const hasOutputHandle = conn?.output === true ||
        (typeof conn?.output === 'object' && conn.output.enabled);

    // Get extra handles from widget (if widget declares them)
    const extraHandles = useMemo(() => {
        if (!field.widget) return [];
        return getWidgetInputHandles(field.widget, value);
    }, [field.widget, value]);

    // Format display value
    const formatValue = (val: any) => {
        if (val === undefined || val === '' || val === null) return null;
        if (typeof val === 'boolean') return val ? 'Yes' : 'No';
        if (typeof val === 'object') {
            // Special case: LLMConfigValue - show model name
            if (val.modelId) {
                const id = val.modelId as string;
                const shortName = id
                    .replace(/-preview.*$/, '')
                    .replace(/-latest$/, '')
                    .replace(/-exp$/, '')
                    .split('-')
                    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
                    .join('-');
                return shortName.length > 15 ? shortName.slice(0, 15) + '...' : shortName;
            }
            // Special case: image value
            if (val.url || val.base64) {
                return '🖼️ Image';
            }
            return JSON.stringify(val).slice(0, 20) + '...';
        }
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
                <NodePort.Input id={field.key} connected={isConnected} />
            )}

            {/* Extra Input Handles from Widget (stacked vertically if multiple) */}
            {extraHandles.map((h) => (
                <NodePort.Input
                    key={h.id}
                    id={`${field.key}:${h.id}`}
                    connected={false}
                />
            ))}

            {/* Field Info */}
            <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
                {/* Label */}
                <div className="flex items-center gap-1.5 shrink-0">
                    <span className={cn(
                        "text-[11px] font-medium truncate max-w-[70px]",
                        isMissing && !isConnected ? "text-destructive" : "text-muted-foreground"
                    )}>
                        {field.label || field.key}
                    </span>
                    {/* Show badge if extra handles exist */}
                    {extraHandles.length > 0 && (
                        <span className="text-[9px] text-purple-500 bg-purple-500/10 px-1 rounded">
                            +{extraHandles.length}
                        </span>
                    )}
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
                </div>
            </div>

            {/* Output Handle (Right) */}
            {hasOutputHandle && (
                <NodePort.Output id={typeof conn?.output === 'object' && conn.output.handleId ? conn.output.handleId : `field:${field.key}`} />
            )}
        </div>
    );
}

// ============================================================================
// RecipeFormRenderer - Full form for node body
// ============================================================================

export interface RecipeFormRendererProps {
    fields: FieldDefinition[];
    values: Record<string, any>;
    connectedValues?: Record<string, any>;
    isCollapsed?: boolean;
    onChange?: (key: string, value: any) => void;
}

export function RecipeFormRenderer({
    fields,
    values,
    connectedValues = {},
    isCollapsed = false,
    onChange,
}: RecipeFormRendererProps) {
    // Filter fields that have handles (for collapsed view)
    const fieldsWithHandles = fields.filter(field => {
        if (field.hidden) return false;
        const conn = field.connection;
        return conn?.input === true ||
            (typeof conn?.input === 'object' && conn.input.enabled) ||
            conn?.output === true ||
            (typeof conn?.output === 'object' && conn.output.enabled) ||
            field.widget === 'json-input' ||
            field.type === 'object';
    });

    // Filter out hidden fields from visible schema
    const visibleFields = fields.filter(field => !field.hidden);

    // When collapsed, only show fields with handles
    const fieldsToShow = isCollapsed ? fieldsWithHandles : visibleFields;

    if (fieldsToShow.length === 0) {
        return null;
    }

    return (
        <div className={cn("space-y-1.5", isCollapsed && "py-1")}>
            {fieldsToShow.map(field => (
                <RecipeFieldRow
                    key={field.id}
                    field={field}
                    value={values[field.key]}
                    connectedValues={connectedValues}
                    onChange={onChange ? (v) => onChange(field.key, v) : undefined}
                />
            ))}
        </div>
    );
}
