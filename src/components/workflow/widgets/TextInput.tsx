// TextInput Widget
// Simple text/number input widget

import { Input } from '@/components/ui/input';
import { Link } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetDefinition, WidgetProps } from './types';

// ============================================================================
// Widget Component
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
// Widget Definition Export
// ============================================================================

export const TextInputWidget: WidgetDefinition = {
    id: 'text-input',
    render: (props) => <WidgetComponent {...props} />,
};


