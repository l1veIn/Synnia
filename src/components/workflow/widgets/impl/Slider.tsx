// Slider Widget
// Numeric input with slider control

import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { SlidersHorizontal } from 'lucide-react';
import { WidgetDefinition, WidgetProps } from '../lib/types';

/** Slider widget configuration */
interface SliderConfig {
    min?: number;
    max?: number;
    step?: number;
}

function SliderComponent({ value, onChange, disabled, field }: WidgetProps) {
    const config = (field?.config || {}) as SliderConfig;
    const min = config.min ?? 0;
    const max = config.max ?? 100;
    const step = config.step ?? 1;
    const numValue = Number(value) || min;

    const handleSliderChange = (vals: number[]) => {
        onChange(vals[0]);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = Number(e.target.value);
        if (!isNaN(val)) {
            onChange(Math.min(max, Math.max(min, val)));
        }
    };

    return (
        <div className="flex items-center gap-3">
            <Slider
                value={[numValue]}
                min={min}
                max={max}
                step={step}
                onValueChange={handleSliderChange}
                className="flex-1"
                disabled={disabled}
            />
            <Input
                type="number"
                value={numValue}
                onChange={handleInputChange}
                min={min}
                max={max}
                step={step}
                disabled={disabled}
                className="w-16 h-8 text-xs text-center"
            />
        </div>
    );
}

export const SliderWidget: WidgetDefinition = {
    id: 'slider',
    render: (props) => <SliderComponent {...props} />,
    meta: {
        label: 'Slider',
        description: 'Numeric input with slider control',
        category: 'number',
        outputType: 'number',
        icon: SlidersHorizontal,
    },
    configSchema: [
        { key: 'min', type: 'number', label: 'Min Value' },
        { key: 'max', type: 'number', label: 'Max Value' },
        { key: 'step', type: 'number', label: 'Step' },
    ],
    getCapability: () => ({ hasInputPort: false, hasOutputPort: false }),
};
