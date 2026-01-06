// Number Widget
// Simple number input (baseline widget for number type)

import { Input } from '@/components/ui/input';
import { Hash } from 'lucide-react';
import { WidgetDefinition, WidgetProps } from '../lib/types';

/** Number widget configuration */
interface NumberConfig {
    min?: number;
    max?: number;
    step?: number;
    placeholder?: string;
}

function NumberComponent({ value, onChange, disabled, field }: WidgetProps) {
    const config = (field?.config || {}) as NumberConfig;
    const { min, max, step, placeholder } = config;

    return (
        <Input
            type="number"
            className="h-8 text-xs"
            value={value ?? ''}
            onChange={(e) => onChange(Number(e.target.value))}
            placeholder={placeholder}
            disabled={disabled}
            min={min}
            max={max}
            step={step}
        />
    );
}

export const NumberWidget: WidgetDefinition = {
    id: 'number',
    render: (props) => <NumberComponent {...props} />,
    meta: {
        label: 'Number',
        description: 'Simple number input',
        category: 'number',
        outputType: 'number',
        icon: Hash,
    },
    configSchema: [
        { key: 'min', type: 'number', label: 'Min' },
        { key: 'max', type: 'number', label: 'Max' },
        { key: 'step', type: 'number', label: 'Step' },
        { key: 'placeholder', type: 'string', label: 'Placeholder' },
    ],
    getCapability: () => ({ hasInputPort: false, hasOutputPort: false }),
};
