// Switch Widget
// Boolean toggle control

import { Switch } from '@/components/ui/switch';
import { ToggleLeft } from 'lucide-react';
import { WidgetDefinition, WidgetProps } from '../lib/types';

function SwitchComponent({ value, onChange, disabled }: WidgetProps) {
    return (
        <div className="flex items-center h-8">
            <Switch
                checked={!!value}
                onCheckedChange={onChange}
                disabled={disabled}
            />
            <span className="ml-2 text-xs text-muted-foreground">
                {value ? 'True' : 'False'}
            </span>
        </div>
    );
}

export const SwitchWidget: WidgetDefinition = {
    id: 'switch',
    render: (props) => <SwitchComponent {...props} />,
    meta: {
        label: 'Switch',
        description: 'Boolean toggle',
        category: 'selection',
        outputType: 'boolean',
        icon: ToggleLeft,
    },
    getCapability: () => ({ hasInputPort: false, hasOutputPort: false }),
};
