// AspectRatioSelector Widget
// Visual aspect ratio picker with toggle group

import { cn } from '@/lib/utils';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { WidgetDefinition, WidgetProps } from '../lib/types';

// Visual representation of ratios
const RATIOS = [
    { id: '1:1', label: 'Square (1:1)', w: 16, h: 16 },
    { id: '16:9', label: 'Landscape (16:9)', w: 24, h: 14 },
    { id: '9:16', label: 'Portrait (9:16)', w: 14, h: 24 },
    { id: '4:3', label: 'Classic (4:3)', w: 20, h: 15 },
    { id: '3:4', label: 'Vertical (3:4)', w: 15, h: 20 },
    { id: '21:9', label: 'Cinema (21:9)', w: 26, h: 11 },
];

// ============================================================================
// Inspector Component (render)
// ============================================================================

function InspectorComponent({ value, onChange, disabled }: WidgetProps) {
    const currentValue = value || '1:1';

    return (
        <ToggleGroup
            type="single"
            value={currentValue}
            onValueChange={(val) => val && onChange(val)}
            disabled={disabled}
            className="flex flex-wrap gap-2 justify-start bg-muted/20 p-1.5 rounded-lg border border-border/50"
        >
            <TooltipProvider>
                {RATIOS.map((ratio) => (
                    <Tooltip key={ratio.id} delayDuration={300}>
                        <TooltipTrigger asChild>
                            <ToggleGroupItem
                                value={ratio.id}
                                size="sm"
                                className={cn(
                                    "h-9 px-2 data-[state=on]:bg-background data-[state=on]:shadow-sm data-[state=on]:border-muted-foreground/20 border border-transparent transition-all",
                                    "hover:bg-muted/50"
                                )}
                            >
                                <div className="flex flex-col items-center gap-1">
                                    <div
                                        className={cn(
                                            "border-2 rounded-sm bg-muted-foreground/10 transition-colors",
                                            currentValue === ratio.id ? "border-primary bg-primary/10" : "border-muted-foreground/40"
                                        )}
                                        style={{
                                            width: `${ratio.w}px`,
                                            height: `${ratio.h}px`,
                                        }}
                                    />
                                </div>
                            </ToggleGroupItem>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs">
                            <p>{ratio.label}</p>
                        </TooltipContent>
                    </Tooltip>
                ))}
            </TooltipProvider>
        </ToggleGroup>
    );
}

// ============================================================================
// Widget Definition Export
// ============================================================================

export const AspectRatioSelectorWidget: WidgetDefinition = {
    id: 'aspect-ratio',
    render: (props) => <InspectorComponent {...props} />,
};

// Backward compatibility export
export { InspectorComponent as AspectRatioSelector };
