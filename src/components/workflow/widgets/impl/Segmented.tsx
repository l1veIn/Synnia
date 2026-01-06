// Segmented Widget
// Horizontal toggle group for mutually exclusive options (like iOS Segmented Control)

import { cn } from '@/lib/utils';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { LayoutGrid } from 'lucide-react';
import { WidgetDefinition, WidgetProps } from '../lib/types';

/** Segmented widget configuration */
interface SegmentedConfig {
    options?: Array<{ value: string; label: string }>;
}

function SegmentedComponent({ value, onChange, disabled, field }: WidgetProps) {
    const config = (field?.config || {}) as SegmentedConfig;
    const options = config.options || [];
    const currentValue = value !== undefined && value !== null ? String(value) : '';

    if (options.length === 0) {
        return (
            <div className="text-xs text-muted-foreground/60 italic py-2">
                No options configured
            </div>
        );
    }

    return (
        <ToggleGroup
            type="single"
            value={currentValue}
            onValueChange={(val) => val && onChange(val)}
            disabled={disabled}
            className="flex flex-wrap gap-1 bg-muted/30 p-1 rounded-lg"
        >
            {options.map((opt) => (
                <ToggleGroupItem
                    key={opt.value}
                    value={opt.value}
                    size="sm"
                    className={cn(
                        "px-3 h-7 text-xs font-medium transition-all",
                        "data-[state=on]:bg-background data-[state=on]:shadow-sm",
                        "data-[state=on]:text-foreground",
                        "hover:bg-muted/50"
                    )}
                >
                    {opt.label}
                </ToggleGroupItem>
            ))}
        </ToggleGroup>
    );
}

export const SegmentedWidget: WidgetDefinition = {
    id: 'segmented',
    render: (props) => <SegmentedComponent {...props} />,
    meta: {
        label: 'Segmented',
        description: 'Horizontal toggle group',
        category: 'selection',
        outputType: 'string',
        icon: LayoutGrid,
    },
    configSchema: [
        { key: 'options', type: 'array', label: 'Options (value:label)' },
    ],
    getCapability: () => ({ hasInputPort: false, hasOutputPort: false }),
};
