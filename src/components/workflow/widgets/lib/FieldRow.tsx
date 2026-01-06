// FieldRow - Renders input field rows in node body
// RecipeFieldRow manages handles and container; widgets optionally customize value content

import { useNodeConnections } from '@xyflow/react';
import { FieldDefinition } from '@/types/assets';
import { NodePort } from '@/components/workflow/nodes/primitives/NodePort';
import { getWidget } from './registry';
import { cn } from '@/lib/utils';
import { FieldContentProps } from './types';

// ============================================================================
// RecipeFieldRow - Individual field row with unified handle management
// Widget's renderFieldContent only controls the right-side value area
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
    const isMissing = field.required && (value === undefined || value === '' || value === null);
    const isDisabled = field.hidden === true;

    // Get widget for potential custom content rendering
    const widget = field.widget ? getWidget(field.widget) : undefined;

    // --- Unified Handle Logic (widget-agnostic) ---
    const conn = field.connection;
    const hasInputHandle = conn === 'input' || conn === 'both' ||
        field.widget === 'form-input' || field.widget === 'table-input' ||
        field.type === 'object' || field.type === 'array';
    const hasOutputHandle = conn === 'output' || conn === 'both';

    // --- Value Content Rendering ---
    const renderValueContent = () => {
        // If widget provides custom content renderer, use it
        if (widget?.renderFieldContent) {
            const contentProps: FieldContentProps = {
                field,
                value,
                onChange: onChange || (() => { }),
                disabled: isDisabled,
                isConnected,
                connectedValues,
            };
            return widget.renderFieldContent(contentProps);
        }

        // Default value preview
        return <DefaultValueContent value={value} isConnected={isConnected} isDisabled={isDisabled} />;
    };

    return (
        <div className={cn(
            "relative flex items-center gap-3 py-1.5 px-2 rounded-md transition-colors",
            "bg-background/50 hover:bg-background/80 border border-transparent",
            isConnected && "border-blue-500/30 bg-blue-500/5",
            isDisabled && "bg-muted/30 opacity-70",
            isMissing && !isConnected && "border-destructive/40 bg-destructive/5"
        )}>
            {/* Input Handle (Left) - managed by RecipeFieldRow */}
            {hasInputHandle && (
                <NodePort.Input id={field.key} connected={isConnected} />
            )}

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
                </div>

                {/* Value Content - delegated to widget or default */}
                <div className="flex items-center gap-1.5">
                    {renderValueContent()}
                </div>
            </div>

            {/* Output Handle (Right) - managed by RecipeFieldRow */}
            {hasOutputHandle && (
                <NodePort.Output id={`field:${field.key}`} />
            )}
        </div>
    );
}

// ============================================================================
// DefaultValueContent - Default value preview when widget doesn't customize
// ============================================================================

function DefaultValueContent({
    value,
    isConnected,
    isDisabled
}: {
    value: any;
    isConnected: boolean;
    isDisabled: boolean;
}) {
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
            // Array preview
            if (Array.isArray(val)) {
                return `[${val.length} items]`;
            }
            return JSON.stringify(val).slice(0, 20) + '...';
        }
        const str = String(val);
        return str.length > 25 ? str.slice(0, 25) + '...' : str;
    };

    const displayValue = formatValue(value);

    if (isConnected) {
        return (
            <span className="inline-flex items-center gap-1 text-[10px] text-blue-500 font-medium bg-blue-500/10 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                linked
            </span>
        );
    }

    if (displayValue) {
        return (
            <span className={cn(
                "text-[11px] font-mono px-2 py-0.5 rounded",
                isDisabled ? "bg-muted/50 text-muted-foreground" : "bg-muted/80 text-foreground"
            )}>
                {displayValue}
            </span>
        );
    }

    return <span className="text-[10px] text-muted-foreground/50 italic">empty</span>;
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
        return conn === 'input' || conn === 'output' || conn === 'both' ||
            field.widget === 'form-input' || field.widget === 'table-input' ||
            field.type === 'object' || field.type === 'array';
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
                    key={field.key}
                    field={field}
                    value={values[field.key]}
                    connectedValues={connectedValues}
                    onChange={onChange ? (v) => onChange(field.key, v) : undefined}
                />
            ))}
        </div>
    );
}
