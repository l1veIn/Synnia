// ColorPicker Widget
// Color input widget with color picker and hex input

import { Input } from '@/components/ui/input';
import { Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetDefinition, WidgetProps, FieldContentProps } from '../lib/types';

// ============================================================================
// Widget Component (for Inspector)
// ============================================================================

function WidgetComponent({ value, onChange, disabled, field }: WidgetProps) {
    const safeValue = value || '#000000';

    return (
        <div className="flex items-center gap-2 h-8">
            <input
                type="color"
                className={cn(
                    "h-7 w-10 rounded border border-border cursor-pointer",
                    "bg-transparent transition-colors",
                    "hover:border-primary/50 focus:border-primary",
                    disabled && "cursor-not-allowed opacity-50"
                )}
                value={safeValue}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
            />
            <Input
                value={safeValue}
                onChange={(e) => onChange(e.target.value)}
                placeholder="#000000"
                disabled={disabled}
                className="flex-1 h-8 text-xs font-mono"
            />
        </div>
    );
}

// ============================================================================
// FieldContent Renderer - Custom color preview with swatch
// ============================================================================

function renderFieldContent({ value, isConnected }: FieldContentProps) {
    const displayColor = value || '#000000';
    const isValidHex = /^#[0-9A-Fa-f]{6}$/.test(displayColor);

    if (isConnected) {
        return (
            <span className="inline-flex items-center gap-1 text-[10px] text-blue-500 font-medium bg-blue-500/10 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                linked
            </span>
        );
    }

    if (isValidHex) {
        return (
            <div className="flex items-center gap-1.5">
                <div
                    className="w-4 h-4 rounded border border-border shadow-sm"
                    style={{ backgroundColor: displayColor }}
                />
                <span className="text-[11px] font-mono text-muted-foreground">
                    {displayColor}
                </span>
            </div>
        );
    }

    return <span className="text-[10px] text-muted-foreground/50 italic">empty</span>;
}

// ============================================================================
// Widget Definition Export
// ============================================================================

export const ColorPickerWidget: WidgetDefinition = {
    id: 'color',
    render: (props) => <WidgetComponent {...props} />,
    meta: {
        label: 'Color Picker',
        description: 'Hex color selection',
        category: 'selection',
        outputType: 'string',
        icon: Palette,
    },
    renderFieldContent,
    getCapability: () => ({ hasInputPort: false, hasOutputPort: false }),
};

