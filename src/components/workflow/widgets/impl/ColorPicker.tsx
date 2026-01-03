// ColorPicker Widget
// Color input widget with color picker and hex input, following TextInput pattern

import { Input } from '@/components/ui/input';
import { Link } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetDefinition, WidgetProps, FieldRowProps } from '../lib/types';
import { NodePort } from '@/components/workflow/nodes/primitives/NodePort';

// ============================================================================
// Widget Component (for Inspector)
// ============================================================================

function WidgetComponent({ value, onChange, disabled, field }: WidgetProps) {
    const safeValue = value || '#000000';

    return (
        <div className="flex items-center gap-2 h-8">
            <input
                type="color"
                className={cn(
                    "h-7 w-10 rounded border border-border cursor-pointer",
                    "bg-transparent transition-colors",
                    "hover:border-primary/50 focus:border-primary",
                    disabled && "cursor-not-allowed opacity-50"
                )}
                value={safeValue}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
            />
            <Input
                value={safeValue}
                onChange={(e) => onChange(e.target.value)}
                placeholder="#000000"
                disabled={disabled}
                className="flex-1 h-8 text-xs font-mono"
            />
        </div>
    );
}

// ============================================================================
// FieldRow Renderer (for Node Body)
// ============================================================================

function renderFieldRow({ field, value, isConnected, disabled }: FieldRowProps) {
    const conn = field.connection;
    const hasInputHandle = conn === 'input' || conn === 'both';
    const hasOutputHandle = conn === 'output' || conn === 'both';
    const isMissing = field.required && !value && !isConnected;

    const displayColor = value || '#000000';
    const isValidHex = /^#[0-9A-Fa-f]{6}$/.test(displayColor);

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
                    ) : isValidHex ? (
                        <div className="flex items-center gap-1.5">
                            <div
                                className="w-4 h-4 rounded border border-border shadow-sm"
                                style={{ backgroundColor: displayColor }}
                            />
                            <span className="text-[11px] font-mono text-muted-foreground">
                                {displayColor}
                            </span>
                        </div>
                    ) : (
                        <span className="text-[10px] text-muted-foreground/50 italic">empty</span>
                    )}
                </div>
            </div>

            {hasOutputHandle && (
                <NodePort.Output id={`field:${field.key}`} />
            )}
        </div>
    );
}

// ============================================================================
// Widget Definition Export
// ============================================================================

export const ColorPickerWidget: WidgetDefinition = {
    id: 'color',
    render: (props) => <WidgetComponent {...props} />,
    renderFieldRow,
};
