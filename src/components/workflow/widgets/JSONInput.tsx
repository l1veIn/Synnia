// JSONInput Widget
// Visual display for JSON input fields showing expected keys and connection status

import { Link2, Check, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetDefinition, WidgetProps } from './types';

// ============================================================================
// Inspector Component (render)
// ============================================================================

function InspectorComponent({ value, disabled, field }: WidgetProps) {
    const options = (field as any)?.options || {};
    const { requiredKeys = [], isConnected = false, connectedLabel = 'Connected' } = options;

    // Parse value to check keys
    const connectedValue = isConnected && value && typeof value === 'object' ? value : null;
    const presentKeys = connectedValue ? Object.keys(connectedValue) : [];
    const hasExpectedKeys = requiredKeys.length > 0;

    // Calculate validation status
    const validationStatus = requiredKeys.map((key: string) => {
        const isPresent = presentKeys.includes(key);
        const hasValue = connectedValue &&
            connectedValue[key] !== undefined &&
            connectedValue[key] !== null &&
            connectedValue[key] !== '';
        return { key, isPresent, hasValue };
    });

    const allValid = validationStatus.every((s: { hasValue: boolean }) => s.hasValue);
    const someValid = validationStatus.some((s: { hasValue: boolean }) => s.hasValue);

    // If connected, show connection status with validation
    if (isConnected) {
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
                            {connectedLabel}
                        </p>
                    </div>
                </div>

                {/* Expected Keys with Validation */}
                {hasExpectedKeys && (
                    <div className="flex flex-wrap gap-1.5">
                        {validationStatus.map(({ key, hasValue }: { key: string; hasValue: boolean }) => (
                            <span
                                key={key}
                                className={cn(
                                    "inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono",
                                    hasValue
                                        ? "bg-green-500/10 text-green-600 border border-green-500/20"
                                        : "bg-red-500/10 text-red-500 border border-red-500/20"
                                )}
                            >
                                {hasValue ? (
                                    <Check className="h-3 w-3" />
                                ) : (
                                    <X className="h-3 w-3" />
                                )}
                                {key}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // Not connected - show placeholder with expected keys
    return (
        <div className="w-full rounded-lg border-2 border-dashed border-muted-foreground/20 p-3 space-y-2 bg-muted/10">
            {/* Placeholder */}
            <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/10">
                    <Link2 className="h-3.5 w-3.5 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">JSON Input</p>
                    <p className="text-[10px] text-muted-foreground/60">Connect a JSON node on canvas</p>
                </div>
            </div>

            {/* Expected Keys Preview */}
            {hasExpectedKeys && (
                <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Expected Keys</p>
                    <div className="flex flex-wrap gap-1">
                        {requiredKeys.map((key: string) => (
                            <span
                                key={key}
                                className="inline-flex items-center px-2 py-0.5 rounded bg-muted text-[10px] font-mono text-muted-foreground"
                            >
                                {key}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// Widget Definition Export
// ============================================================================

export const JSONInputWidget: WidgetDefinition = {
    id: 'json-input',
    render: (props) => <InspectorComponent {...props} />,
};

// Backward compatibility export
export { InspectorComponent as JSONInput };
