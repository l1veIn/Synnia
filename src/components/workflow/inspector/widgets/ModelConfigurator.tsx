import { useState, useEffect, useMemo, useCallback } from 'react';
import { Check, ChevronsUpDown, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { getAvailableModels, getModelById, ModelDefinition, RecipeType } from '@/lib/services/media/models';

// Return type of the configurator
export interface ModelConfig {
    modelId: string;
    aspectRatio?: string;
    resolution?: string;
    duration?: number;
    numImages?: number;
}

interface ModelConfiguratorProps {
    value?: ModelConfig;
    onChange: (value: ModelConfig) => void;
    disabled?: boolean;
    filterRecipeType?: string;
}

export function ModelConfigurator({ value, onChange, disabled, filterRecipeType }: ModelConfiguratorProps) {
    const [open, setOpen] = useState(false);

    // Get available models based on filter
    const models = useMemo(() => {
        const allProviders = ['openai', 'fal', 'replicate', 'ppio', 'modelscope', 'kie'];
        if (filterRecipeType) {
            return getAvailableModels(filterRecipeType as RecipeType, allProviders);
        }
        return getAvailableModels('text-to-image', allProviders);
    }, [filterRecipeType]);

    // Current model definition
    const selectedModel = useMemo(() => {
        if (!value?.modelId) return null;
        return getModelById(value.modelId);
    }, [value?.modelId]);

    // Handle model selection
    const handleModelSelect = useCallback((modelId: string) => {
        const model = getModelById(modelId);
        if (!model) return;

        // Initialize with defaults from new model
        const newConfig: ModelConfig = {
            modelId,
            aspectRatio: model.aspectRatios?.[0],
            resolution: model.resolutions?.[0],
            duration: model.durations?.[0],
            numImages: 1,
        };
        onChange(newConfig);
        setOpen(false);
    }, [onChange]);

    // Handle param changes
    const handleParamChange = useCallback((key: keyof ModelConfig, val: any) => {
        if (!value) return;
        onChange({ ...value, [key]: val });
    }, [value, onChange]);

    return (
        <div className="space-y-3">
            {/* Model Selector */}
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between h-9 text-xs bg-background"
                        disabled={disabled}
                    >
                        {selectedModel ? (
                            <div className="flex items-center gap-2 truncate">
                                <Badge variant="secondary" className="px-1 py-0 h-5 text-[10px] uppercase font-normal text-muted-foreground">
                                    {selectedModel.provider}
                                </Badge>
                                <span className="truncate">{selectedModel.name}</span>
                            </div>
                        ) : (
                            <span className="text-muted-foreground">Select model...</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0" align="start">
                    <Command>
                        <CommandInput placeholder="Search models..." className="h-8 text-xs" />
                        <CommandList>
                            <CommandEmpty>No model found.</CommandEmpty>
                            <CommandGroup heading="Available Models">
                                {models.map((model) => (
                                    <CommandItem
                                        key={model.id}
                                        value={model.name}
                                        onSelect={() => handleModelSelect(model.id)}
                                        className="text-xs"
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-3 w-3",
                                                value?.modelId === model.id ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        <div className="flex flex-col gap-0.5">
                                            <span>{model.name}</span>
                                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                                <span className="uppercase">{model.provider}</span>
                                                {model.resolutions && (
                                                    <span className="bg-muted px-1 rounded">HD</span>
                                                )}
                                            </div>
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            {/* Dynamic Model-Specific Parameters */}
            {selectedModel && (
                <div className="p-3 rounded-lg border border-border/50 bg-muted/20 space-y-3">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide">
                        <Settings2 className="h-3 w-3" />
                        Model Options
                    </div>

                    {/* Aspect Ratio */}
                    {selectedModel.aspectRatios && selectedModel.aspectRatios.length > 0 && (
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Aspect Ratio</Label>
                            <div className="flex flex-wrap gap-1.5">
                                {selectedModel.aspectRatios.map((ar) => (
                                    <Button
                                        key={ar}
                                        variant={value?.aspectRatio === ar ? "default" : "outline"}
                                        size="sm"
                                        className="h-7 px-2 text-xs"
                                        onClick={() => handleParamChange('aspectRatio', ar)}
                                        disabled={disabled}
                                    >
                                        {ar}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Resolution (if supported) */}
                    {selectedModel.resolutions && selectedModel.resolutions.length > 0 && (
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Resolution</Label>
                            <Select
                                value={value?.resolution || selectedModel.resolutions[0]}
                                onValueChange={(v) => handleParamChange('resolution', v)}
                                disabled={disabled}
                            >
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {selectedModel.resolutions.map((res) => (
                                        <SelectItem key={res} value={res} className="text-xs">
                                            {res.toUpperCase()}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Duration (for video models) */}
                    {selectedModel.durations && selectedModel.durations.length > 0 && (
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Duration (seconds)</Label>
                            <div className="flex flex-wrap gap-1.5">
                                {selectedModel.durations.map((dur) => (
                                    <Button
                                        key={dur}
                                        variant={value?.duration === dur ? "default" : "outline"}
                                        size="sm"
                                        className="h-7 px-2 text-xs"
                                        onClick={() => handleParamChange('duration', dur)}
                                        disabled={disabled}
                                    >
                                        {dur}s
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Number of Images */}
                    {selectedModel.maxImages && selectedModel.maxImages > 1 && (
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">
                                Number of Images: {value?.numImages || 1}
                            </Label>
                            <Slider
                                value={[value?.numImages || 1]}
                                min={1}
                                max={selectedModel.maxImages}
                                step={1}
                                onValueChange={(vals) => handleParamChange('numImages', vals[0])}
                                disabled={disabled}
                                className="py-1"
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
