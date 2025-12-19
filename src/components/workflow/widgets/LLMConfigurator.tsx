// LLMConfigurator Widget
// Self-contained widget with all forms: Inspector, FieldRow, Handle declarations

import { useState, useMemo, useEffect } from 'react';
import { Check, ChevronsUpDown, Brain, Thermometer, Hash, FileJson } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { useSettings, isProviderConfigured, ProviderKey } from '@/lib/settings';
import {
    getAllLLMModels,
    getLLMModel,
    getLLMModelsForCapability,
    LLMConfigValue,
    LLMModelDefinition,
    LLMCapability
} from '@/lib/models/llm';
import { WidgetDefinition, WidgetProps, HandleSpec } from './types';

// ============================================================================
// Types (re-export for backward compatibility)
// ============================================================================

export type { LLMConfigValue };

// ============================================================================
// Inspector Component (render)
// ============================================================================

function InspectorComponent({ value, onChange, disabled, field }: WidgetProps) {
    const [open, setOpen] = useState(false);
    const { settings } = useSettings();
    const filterCapability = (field as any)?.options?.filterCapability as LLMCapability | undefined;

    // Get available models (optionally filtered by capability)
    const allModels = useMemo(() => {
        if (filterCapability) {
            return getLLMModelsForCapability(filterCapability);
        }
        return getAllLLMModels();
    }, [filterCapability]);

    // Get configured providers
    const configuredProviders = useMemo(() => {
        const providers: ProviderKey[] = [];
        const allProviderKeys: ProviderKey[] = ['openai', 'anthropic', 'google', 'deepseek', 'ollama', 'lmstudio'];
        allProviderKeys.forEach(key => {
            if (settings && isProviderConfigured(settings, key)) {
                providers.push(key);
            }
        });
        return providers;
    }, [settings]);

    // Filter models by configured providers
    const availableModels = useMemo(() => {
        return allModels.filter(m => configuredProviders.includes(m.provider));
    }, [allModels, configuredProviders]);

    // Auto-select default LLM from settings when no value is provided
    useEffect(() => {
        if (!value?.modelId && settings?.defaultLLM && availableModels.length > 0) {
            const defaultModel = availableModels.find(m => m.id === settings.defaultLLM);
            if (defaultModel) {
                onChange({
                    modelId: defaultModel.id,
                    provider: defaultModel.provider,
                    temperature: defaultModel.defaultTemperature ?? 0.7,
                    maxTokens: Math.min(2048, defaultModel.maxOutputTokens),
                    jsonMode: false,
                });
            } else if (availableModels.length > 0) {
                const firstModel = availableModels[0];
                onChange({
                    modelId: firstModel.id,
                    provider: firstModel.provider,
                    temperature: firstModel.defaultTemperature ?? 0.7,
                    maxTokens: Math.min(2048, firstModel.maxOutputTokens),
                    jsonMode: false,
                });
            }
        }
    }, [value?.modelId, settings?.defaultLLM, availableModels, onChange]);

    // Currently selected model
    const selectedModel = useMemo(() => {
        if (!value?.modelId) return null;
        return getLLMModel(value.modelId);
    }, [value?.modelId]);

    // Handle model selection
    const handleModelSelect = (modelId: string) => {
        const model = getLLMModel(modelId);
        if (!model) return;

        onChange({
            modelId,
            provider: model.provider,
            temperature: model.defaultTemperature ?? 0.7,
            maxTokens: Math.min(2048, model.maxOutputTokens),
            jsonMode: false,
        });
        setOpen(false);
    };

    // Handle parameter changes
    const handleTemperatureChange = (temp: number) => {
        if (!value) return;
        onChange({ ...value, temperature: temp });
    };

    const handleMaxTokensChange = (tokens: number) => {
        if (!value) return;
        onChange({ ...value, maxTokens: tokens });
    };

    const handleJsonModeChange = (enabled: boolean) => {
        if (!value) return;
        onChange({ ...value, jsonMode: enabled });
    };

    // Group models by provider
    const modelsByProvider = useMemo(() => {
        const groups: Record<string, LLMModelDefinition[]> = {};
        availableModels.forEach(m => {
            if (!groups[m.provider]) groups[m.provider] = [];
            groups[m.provider].push(m);
        });
        return groups;
    }, [availableModels]);

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
                                <Brain className="h-3.5 w-3.5 text-primary" />
                                <Badge
                                    variant="secondary"
                                    className="px-1 py-0 h-5 text-[10px] uppercase font-normal"
                                >
                                    {selectedModel.provider}
                                </Badge>
                                <span className="truncate">{selectedModel.name}</span>
                            </div>
                        ) : (
                            <span className="text-muted-foreground flex items-center gap-2">
                                <Brain className="h-3.5 w-3.5" />
                                Select LLM model...
                            </span>
                        )}
                        <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="start">
                    <Command>
                        <CommandInput placeholder="Search models..." className="h-8 text-xs" />
                        <CommandList>
                            <CommandEmpty>
                                {availableModels.length === 0
                                    ? "Configure a provider in Settings first"
                                    : "No models found"
                                }
                            </CommandEmpty>
                            {Object.entries(modelsByProvider).map(([provider, models]) => (
                                <CommandGroup key={provider} heading={provider.toUpperCase()}>
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
                                            <div className="flex flex-col gap-0.5 flex-1">
                                                <span className="flex items-center gap-1.5">
                                                    {model.name}
                                                    {model.isLocal && (
                                                        <Badge variant="outline" className="px-1 py-0 h-4 text-[9px]">
                                                            LOCAL
                                                        </Badge>
                                                    )}
                                                </span>
                                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                    {model.capabilities.slice(0, 3).map(c => (
                                                        <span key={c} className="bg-muted px-1 rounded">
                                                            {c}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <span className="text-[10px] text-muted-foreground">
                                                {(model.contextWindow / 1000).toFixed(0)}k
                                            </span>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            ))}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            {/* Parameters (only show when model selected) */}
            {selectedModel && (
                <div className="space-y-3 p-3 rounded-lg border border-border/50 bg-muted/20">
                    {/* Temperature */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs flex items-center gap-1.5">
                                <Thermometer className="h-3 w-3" />
                                Temperature
                            </Label>
                            <span className="text-xs text-muted-foreground font-mono">
                                {(value?.temperature ?? 0.7).toFixed(2)}
                            </span>
                        </div>
                        <Slider
                            value={[value?.temperature ?? 0.7]}
                            onValueChange={([v]) => handleTemperatureChange(v)}
                            min={0}
                            max={2}
                            step={0.01}
                            disabled={disabled}
                            className="py-1"
                        />
                    </div>

                    {/* Max Tokens */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs flex items-center gap-1.5">
                                <Hash className="h-3 w-3" />
                                Max Tokens
                            </Label>
                            <span className="text-xs text-muted-foreground font-mono">
                                {value?.maxTokens ?? 2048}
                            </span>
                        </div>
                        <Slider
                            value={[value?.maxTokens ?? 2048]}
                            onValueChange={([v]) => handleMaxTokensChange(v)}
                            min={256}
                            max={selectedModel.maxOutputTokens}
                            step={256}
                            disabled={disabled}
                            className="py-1"
                        />
                    </div>

                    {/* JSON Mode (if supported) */}
                    {selectedModel.capabilities.includes('json-mode') && (
                        <div className="flex items-center justify-between pt-1">
                            <Label className="text-xs flex items-center gap-1.5">
                                <FileJson className="h-3 w-3" />
                                JSON Mode
                            </Label>
                            <Switch
                                checked={value?.jsonMode ?? false}
                                onCheckedChange={handleJsonModeChange}
                                disabled={disabled}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ============================================================================
// Handle Declarations (getInputHandles)
// ============================================================================

function getInputHandles(value: any): HandleSpec[] {
    if (!value?.modelId) return [];

    const model = getLLMModel(value.modelId);
    if (!model) return [];

    const handles: HandleSpec[] = [];

    // If model supports vision, add image input handle
    if (model.capabilities.includes('vision')) {
        handles.push({
            id: 'visionImage',
            dataType: 'image',
            label: 'Vision Image',
        });
    }

    return handles;
}

// ============================================================================
// Widget Definition Export
// ============================================================================

export const LLMConfiguratorWidget: WidgetDefinition = {
    id: 'llm-configurator',
    render: (props) => <InspectorComponent {...props} />,
    getInputHandles,
};

// Backward compatibility export
export { InspectorComponent as LLMConfigurator };
