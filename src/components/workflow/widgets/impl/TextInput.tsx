// TextInput Widget
// Simple text/number input widget with renderFieldRow support

import { Input } from '@/components/ui/input';
import { Link } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetDefinition, WidgetProps, FieldRowProps } from '../lib/types';
import { NodePort } from '@/components/workflow/nodes/primitives/NodePort';

// ============================================================================
// Widget Component (for Inspector)
// ============================================================================

function WidgetComponent({ value, onChange, disabled, field }: WidgetProps) {
    const options = (field as any)?.options || {};
    const { placeholder, type = 'text', min, max, step, isConnected, connectedLabel = 'Connected', className } = options;

    // When connected, show connected state
    if (isConnected) {
        return (
            <div className={cn(
                "flex items-center gap-2 h-8 px-3 rounded-md border border-blue-500/30 bg-blue-500/5",
                className
            )}>
                <Link className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-xs text-blue-500 font-medium">{connectedLabel}</span>
            </div>
        );
    }

    return (
        <Input
            type={type}
            className={cn("h-8 text-xs", className)}
            value={value ?? ''}
            onChange={(e) => {
                if (type === 'number') {
                    onChange(Number(e.target.value));
                } else {
                    onChange(e.target.value);
                }
            }}
            placeholder={placeholder}
            disabled={disabled}
            min={min}
            max={max}
            step={step}
        />
    );
}

// ============================================================================
// FieldRow Renderer (for Node Body)
// ============================================================================

function renderFieldRow({ field, value, isConnected, disabled }: FieldRowProps) {
    const conn = field.connection;
    const hasInputHandle = conn?.input === true ||
        (typeof conn?.input === 'object' && conn.input.enabled);
    const hasOutputHandle = conn?.output === true ||
        (typeof conn?.output === 'object' && conn.output.enabled);
    const isMissing = field.rules?.required && !value && !isConnected;

    const displayValue = value
        ? String(value).length > 20 ? String(value).slice(0, 20) + '...' : String(value)
        : null;

    return (
        <div className={cn(
            "relative flex items-center gap-3 py-1.5 px-2 rounded-md transition-colors",
            "bg-background/50 hover:bg-background/80 border border-transparent",
            isConnected && "border-blue-500/30 bg-blue-500/5",
            disabled && "bg-muted/30 opacity-70",
            isMissing && "border-destructive/40 bg-destructive/5"
        )}>
            {hasInputHandle && <NodePort.Input id={field.key} connected={isConnected} />}

            <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
                <span className={cn(
                    "text-[11px] font-medium truncate max-w-[70px]",
                    isMissing ? "text-destructive" : "text-muted-foreground"
                )}>
                    {field.label || field.key}
                </span>

                <div className="flex items-center gap-1.5">
                    {isConnected ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-blue-500 font-medium bg-blue-500/10 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                            linked
                        </span>
                    ) : displayValue ? (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted/80 text-foreground">
                            {displayValue}
                        </span>
                    ) : (
                        <span className="text-[10px] text-muted-foreground/50 italic">empty</span>
                    )}
                </div>
            </div>

            {hasOutputHandle && (
                <NodePort.Output id={typeof conn?.output === 'object' && conn.output.handleId ? conn.output.handleId : `field:${field.key}`} />
            )}
        </div>
    );
}

// ============================================================================
// Widget Definition Export
// ============================================================================

export const TextInputWidget: WidgetDefinition = {
    id: 'text-input',
    render: (props) => <WidgetComponent {...props} />,
    renderFieldRow,
};
