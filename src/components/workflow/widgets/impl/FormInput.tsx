// FormInput Widget
// Visual display for object input fields with schema-based validation
// Used when field.type === 'object' with connection input

import { Link2, Check, X, AlertCircle, Braces, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetDefinition, WidgetProps, FieldContentProps } from '../lib/types';
import { graphEngine } from '@core/engine/GraphEngine';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// ============================================================================
// Inspector Component (render)
// ============================================================================

function InspectorComponent({ value, field }: WidgetProps) {
    // Get schema from field definition
    const schema = field?.schema || [];
    const isConnected = value !== undefined && value !== null;
    const connectedValue = isConnected && typeof value === 'object' ? value : null;

    // Calculate validation status based on schema
    const validationStatus = schema.map((f) => {
        const hasValue = connectedValue &&
            connectedValue[f.key] !== undefined &&
            connectedValue[f.key] !== null &&
            connectedValue[f.key] !== '';
        return { key: f.key, label: f.label, hasValue, required: f.required };
    });

    const requiredFields = validationStatus.filter(s => s.required);
    const allValid = requiredFields.every(s => s.hasValue);
    const someValid = validationStatus.some(s => s.hasValue);

    // Create node handler
    const handleCreateNode = () => {
        if (!schema || schema.length === 0) return;
        const newNodeId = graphEngine.mutator.createNodeFromSchema('form', schema, {
            title: field?.label || 'New Form',
        });
        if (newNodeId) {
            toast.success('Form node created');
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
                        allValid ? "bg-green-500/10" : someValid ? "bg-yellow-500/10" : "bg-red-500/10"
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
                            Object Connected
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                            {Object.keys(connectedValue).length} keys
                        </p>
                    </div>
                </div>

                {/* Schema Fields Validation */}
                {schema.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {validationStatus.map(({ key, label, hasValue, required }) => (
                            <span
                                key={key}
                                className={cn(
                                    "inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono",
                                    hasValue
                                        ? "bg-green-500/10 text-green-600 border border-green-500/20"
                                        : required
                                            ? "bg-red-500/10 text-red-500 border border-red-500/20"
                                            : "bg-muted text-muted-foreground border border-transparent"
                                )}
                            >
                                {hasValue ? (
                                    <Check className="h-3 w-3" />
                                ) : required ? (
                                    <X className="h-3 w-3" />
                                ) : null}
                                {label || key}
                            </span>
                        ))}
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
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/10">
                    <Braces className="h-3.5 w-3.5 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">Object Input</p>
                    <p className="text-[10px] text-muted-foreground/60">Connect a Form/JSON node</p>
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
                    Create Form Node
                </Button>
            )}

            {/* Expected Schema Preview */}
            {schema.length > 0 && (
                <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Expected Fields</p>
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
// FieldContent Renderer - Custom content for object fields (icon + key count)
// ============================================================================

function renderFieldContent({ field, value, isConnected }: FieldContentProps) {
    const schema = field.schema || [];
    const connectedValue = isConnected && value && typeof value === 'object' ? value : null;
    const keyCount = connectedValue ? Object.keys(connectedValue).length : 0;

    if (isConnected) {
        return (
            <>
                <Braces className="h-3 w-3 text-blue-500" />
                <span className="inline-flex items-center gap-1 text-[10px] text-blue-500 font-medium bg-blue-500/10 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    {keyCount} keys
                </span>
            </>
        );
    }

    if (schema.length > 0) {
        return (
            <>
                <Braces className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground/50 italic">
                    {schema.length} fields expected
                </span>
            </>
        );
    }

    return (
        <>
            <Braces className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground/50 italic">object</span>
        </>
    );
}

// ============================================================================
// Widget Definition Export
// ============================================================================

export const FormInputWidget: WidgetDefinition = {
    id: 'form-input',
    render: (props) => <InspectorComponent {...props} />,
    meta: {
        label: 'Object',
        description: 'Structured object input',
        category: 'data',
        outputType: 'object',
        icon: Braces,
        supportsInput: true,
        supportsOutput: true,
    },
    renderFieldContent,
    getCapability: (field) => ({
        hasInputPort: true,
        hasOutputPort: field?.connection === 'output' || field?.connection === 'both',
    }),
};

