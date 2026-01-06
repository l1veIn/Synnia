// TextInput Widget
// Simple text/number input widget

import { Input } from '@/components/ui/input';
import { Type } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetDefinition, WidgetProps } from '../lib/types';

/** TextInput widget configuration */
interface TextInputConfig {
    placeholder?: string;
    type?: 'text' | 'number' | 'password';
    min?: number;
    max?: number;
    step?: number;
    className?: string;
}

// ============================================================================
// Widget Component (for Inspector)
// ============================================================================

function WidgetComponent({ value, onChange, disabled, field }: WidgetProps) {
    const config = (field?.config || {}) as TextInputConfig;
    const { placeholder, type = 'text', min, max, step, className } = config;

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
// Note: No renderFieldContent needed - default preview in RecipeFieldRow is sufficient
// ============================================================================

export const TextInputWidget: WidgetDefinition = {
    id: 'text',
    render: (props) => <WidgetComponent {...props} />,
    meta: {
        label: 'Text Input',
        description: 'Single line text input',
        category: 'text',
        outputType: 'string',
        icon: Type,
        supportsInput: true,
        supportsOutput: true,
    },
    configSchema: [
        { key: 'placeholder', type: 'string', label: 'Placeholder' },
    ],
};

