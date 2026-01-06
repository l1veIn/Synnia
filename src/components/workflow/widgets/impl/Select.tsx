// Select Widget
// Dropdown selection control

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ChevronDown } from 'lucide-react';
import { WidgetDefinition, WidgetProps } from '../lib/types';

/** Select widget configuration */
interface SelectConfig {
    options?: string[];
}

function SelectComponent({ value, onChange, disabled, field }: WidgetProps) {
    const config = (field?.config || {}) as SelectConfig;
    const options = config.options || [];
    const safeValue = value !== undefined && value !== null ? String(value) : '';

    return (
        <Select
            value={safeValue}
            onValueChange={onChange}
            disabled={disabled}
        >
            <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
                {options.map((opt: string) => (
                    <SelectItem key={opt} value={opt} className="text-xs">
                        {opt}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

export const SelectWidget: WidgetDefinition = {
    id: 'select',
    render: (props) => <SelectComponent {...props} />,
    meta: {
        label: 'Dropdown',
        description: 'Single selection dropdown',
        category: 'selection',
        outputType: 'string',
        icon: ChevronDown,
    },
    configSchema: [
        { key: 'options', type: 'array', label: 'Options', widget: 'tags' },
    ],
    getCapability: () => ({ hasInputPort: false, hasOutputPort: false }),
};
