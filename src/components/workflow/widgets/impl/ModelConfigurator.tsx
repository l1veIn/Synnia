// ModelConfigurator Widget - Unified for both LLM and Media models
// Self-contained widget with all forms: Inspector, FieldRow, Handle declarations

import { useState, useMemo, useEffect } from 'react';
import { Check, ChevronsUpDown, AlertCircle, Thermometer, Hash, FileJson } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getModel, getModelsForCategory, ModelCategory, ProviderType } from '@/lib/models';
import { useSettings, ProviderKey, isProviderConfigured, getDefaultModel } from '@/lib/settings';
import { WidgetDefinition, WidgetProps, HandleSpec } from '../lib/types';
import { useWidgetServices } from '../lib/WidgetServices';

// ============================================================================
// Types
// ============================================================================

export interface ModelConfigValue {
    modelId: string;
    provider?: ProviderType;
    config: any;
}

// ============================================================================
// Default LLM Settings Component
// ============================================================================

interface LLMSettingsProps {
    value: any;
    onChange: (value: any) => void;
    disabled?: boolean;
    defaultTemperature?: number;
    maxOutputTokens?: number;
    capabilities?: string[];
}

function DefaultLLMSettings({
    value,
    onChange,
    disabled,
    defaultTemperature = 0.7,
    maxOutputTokens = 4096,
    capabilities = []
}: LLMSettingsProps) {
    const config = value || {
        temperature: defaultTemperature,
        maxTokens: Math.min(2048, maxOutputTokens),
        jsonMode: false,
    };

    const handleChange = (key: string, val: any) => {
        onChange({ ...config, [key]: val });
    };

    const supportsJsonMode = capabilities.includes('json-mode');

    return (
        <div className="space-y-3 p-3 rounded-lg border border-border/50 bg-muted/20">
            {/* Temperature */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-xs flex items-center gap-1.5">
                        <Thermometer className="h-3 w-3 text-muted-foreground" />
                        Temperature
                    </Label>
                    <span className="text-xs text-muted-foreground">{config.temperature?.toFixed(2)}</span>
                </div>
                <Slider
                    value={[config.temperature ?? defaultTemperature]}
                    onValueChange={(v) => handleChange('temperature', v[0])}
                    min={0}
                    max={2}
                    step={0.05}
                    disabled={disabled}
                />
            </div>

            {/* Max Tokens */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-xs flex items-center gap-1.5">
                        <Hash className="h-3 w-3 text-muted-foreground" />
                        Max Tokens
                    </Label>
                    <span className="text-xs text-muted-foreground">{config.maxTokens}</span>
                </div>
                <Slider
                    value={[config.maxTokens ?? 2048]}
                    onValueChange={(v) => handleChange('maxTokens', v[0])}
                    min={256}
                    max={maxOutputTokens}
                    step={256}
                    disabled={disabled}
                />
            </div>

            {/* JSON Mode */}
            {supportsJsonMode && (
                <div className="flex items-center justify-between">
                    <Label className="text-xs flex items-center gap-1.5">
                        <FileJson className="h-3 w-3 text-muted-foreground" />
                        JSON Mode
                    </Label>
                    <Switch
                        checked={config.jsonMode ?? false}
                        onCheckedChange={(v) => handleChange('jsonMode', v)}
                        disabled={disabled}
                    />
                </div>
            )}
        </div>
    );
}

// ============================================================================
// Inspector Component (render)
// ============================================================================

function InspectorComponent({ value, onChange, disabled, field }: WidgetProps) {
    const [open, setOpen] = useState(false);
    const { settings, setDefaultModel } = useSettings();
    const { getModel, getModelsForCategory, getAllLLMModels } = useWidgetServices();
    const filterCategory = (field as any)?.options?.category as string | undefined;

    // Determine if this is an LLM category
    const isLLMCategory = filterCategory?.startsWith('llm-') || filterCategory === 'llm';

    // Get available models for this category
    const models = useMemo(() => {
        if (isLLMCategory) {
            // For LLM, get all LLM models and filter by category if specified
            const allLLMs = getAllLLMModels();
            if (filterCategory && filterCategory !== 'llm') {
                // llm-chat includes llm-vision models (vision models can do chat too)
                if (filterCategory === 'llm-chat') {
                    return allLLMs.filter(m => m.category === 'llm-chat' || m.category === 'llm-vision');
                }
                return allLLMs.filter(m => m.category === filterCategory);
            }
            return allLLMs;
        }
        // For media models
        if (filterCategory) {
            return getModelsForCategory(filterCategory as ModelCategory);
        }
        return getModelsForCategory('image-generation');
    }, [filterCategory, isLLMCategory]);

    // Current selected model
    const selectedModel = useMemo(() => {
        if (!value?.modelId) return null;
        if (isLLMCategory) {
            return getAllLLMModels().find(m => m.id === value.modelId);
        }
        return getModel(value.modelId);
    }, [value?.modelId, isLLMCategory]);

    // Get providers user has configured
    const configuredProviders = useMemo(() => {
        const providers: ProviderType[] = [];
        if (settings) {
            const allProviderKeys: ProviderKey[] = ['openai', 'anthropic', 'google', 'fal', 'replicate', 'deepseek', 'ollama', 'lmstudio', 'comfyui'];
            allProviderKeys.forEach(key => {
                if (isProviderConfigured(settings, key)) {
                    providers.push(key as ProviderType);
                }
            });
        }
        return providers;
    }, [settings]);

    // Available providers for current model
    const availableProviders = useMemo(() => {
        if (!selectedModel) return [];
        return selectedModel.supportedProviders.filter(p => configuredProviders.includes(p));
    }, [selectedModel, configuredProviders]);

    // Auto-select default model if none selected
    useEffect(() => {
        if (!value?.modelId && settings && models.length > 0) {
            const category = filterCategory || (isLLMCategory ? 'llm-chat' : 'image-generation');
            const defaultModelId = getDefaultModel(settings, category);

            // Find the default model, or fallback to first available
            let modelToSelect = defaultModelId
                ? models.find(m => m.id === defaultModelId)
                : null;

            if (!modelToSelect) {
                // Fallback to first model with configured provider
                modelToSelect = models.find(m =>
                    m.supportedProviders.some(p => configuredProviders.includes(p))
                );
            }

            if (modelToSelect) {
                const availableProvider = modelToSelect.supportedProviders.find(p => configuredProviders.includes(p));
                onChange({
                    modelId: modelToSelect.id,
                    provider: availableProvider,
                    config: {},
                });
            }
        }
    }, [value?.modelId, settings, models, configuredProviders, filterCategory, isLLMCategory]);

    // Handle model selection
    const handleModelSelect = async (modelId: string) => {
        const model = isLLMCategory
            ? getAllLLMModels().find(m => m.id === modelId)
            : getModel(modelId);
        if (!model) return;

        const availableProvider = model.supportedProviders.find(p => configuredProviders.includes(p));

        onChange({
            modelId,
            provider: availableProvider,
            config: {},
        });
        setOpen(false);

        // Update default model for this category
        const category = filterCategory || model.category;
        if (category) {
            await setDefaultModel(category, modelId);
        }
    };

    // Handle config change
    const handleConfigChange = (config: any) => {
        if (!value) return;
        onChange({ ...value, config });
    };

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
                                <Badge
                                    variant="secondary"
                                    className="px-1 py-0 h-5 text-[10px] uppercase font-normal text-muted-foreground"
                                >
                                    {value?.provider || selectedModel.supportedProviders[0]}
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
                            <CommandEmpty>No models found.</CommandEmpty>
                            <CommandGroup heading="Available Models">
                                {models.map((model) => {
                                    const hasProvider = model.supportedProviders.some(p =>
                                        configuredProviders.includes(p)
                                    );
                                    return (
                                        <CommandItem
                                            key={model.id}
                                            value={model.name}
                                            onSelect={() => handleModelSelect(model.id)}
                                            className={cn("text-xs", !hasProvider && "opacity-50")}
                                            disabled={!hasProvider}
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-3 w-3",
                                                    value?.modelId === model.id ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            <div className="flex flex-col gap-0.5">
                                                <span>{model.name}</span>
                                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                    {model.supportedProviders.map(p => (
                                                        <span
                                                            key={p}
                                                            className={cn(
                                                                "uppercase",
                                                                configuredProviders.includes(p)
                                                                    ? "text-green-500"
                                                                    : "text-muted-foreground/50"
                                                            )}
                                                        >
                                                            {p}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            {/* No provider configured warning */}
            {selectedModel && availableProviders.length === 0 && (
                <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-3 w-3" />
                    <AlertDescription className="text-xs">
                        需要配置 {selectedModel.supportedProviders.join(' 或 ')} 的 API Key
                    </AlertDescription>
                </Alert>
            )}

            {/* Model's config UI */}
            {selectedModel && availableProviders.length > 0 && (
                <>
                    {selectedModel.renderConfig ? (
                        // Model has custom config UI
                        selectedModel.renderConfig({
                            value: value?.config,
                            onChange: handleConfigChange,
                            disabled,
                            availableProviders,
                        })
                    ) : isLLMCategory ? (
                        // LLM model without custom config: use default settings
                        <DefaultLLMSettings
                            value={value?.config}
                            onChange={handleConfigChange}
                            disabled={disabled}
                            defaultTemperature={(selectedModel as any).defaultTemperature}
                            maxOutputTokens={(selectedModel as any).maxOutputTokens}
                            capabilities={(selectedModel as any).capabilities}
                        />
                    ) : null}
                </>
            )}
        </div>
    );
}

// ============================================================================
// Handle Declarations (getInputHandles)
// ============================================================================

function getInputHandles(value: any, getModelFn?: (id: string) => any): HandleSpec[] {
    const getModelFunc = getModelFn || getModel;
    if (!value?.modelId) return [];

    const model = getModelFunc(value.modelId);
    if (!model) return [];

    // If model declares its own handles, use those
    if (model.getInputHandles) {
        return model.getInputHandles(value.config);
    }

    // Fallback for LLM vision models (legacy support)
    const handles: HandleSpec[] = [];
    if (model.capabilities?.includes('vision')) {
        handles.push({
            id: 'visionImage',
            dataType: 'image',
            label: 'Vision Image',
        });
    }

    return handles;
}

// ============================================================================
// FieldRow Component (renderFieldRow)
// ============================================================================

import { FieldRowProps } from '../lib/types';
import { NodePort } from '@/components/workflow/nodes/primitives/NodePort';

function FieldRowComponent({ value, onChange, disabled, field, isConnected, connectedValues }: FieldRowProps) {
    const { getModel, getAllLLMModels } = useWidgetServices();
    const filterCategory = (field as any)?.options?.category as string | undefined;
    const isLLMCategory = filterCategory?.startsWith('llm-') || filterCategory === 'llm';

    // Get the selected model
    const selectedModel = useMemo(() => {
        if (!value?.modelId) return null;
        if (isLLMCategory) {
            return getAllLLMModels().find(m => m.id === value.modelId);
        }
        return getModel(value.modelId);
    }, [value?.modelId, isLLMCategory]);

    // Get dynamic handles from model
    const dynamicHandles: HandleSpec[] = useMemo(() => {
        if ((selectedModel as any)?.getInputHandles) {
            return (selectedModel as any).getInputHandles(value?.config);
        }
        // Fallback for LLM vision
        if ((selectedModel as any)?.capabilities?.includes('vision')) {
            return [{ id: 'visionImage', dataType: 'image', label: 'Vision Image' }];
        }
        return [];
    }, [selectedModel, value?.config]);

    // Check which handles are connected
    const getHandleConnected = (handleId: string) => {
        const fullId = `${field.key}:${handleId}`;
        return !!connectedValues[fullId];
    };

    return (
        <div className={cn(
            "relative flex items-start gap-3 py-1.5 px-2 rounded-md transition-colors",
            "bg-background/50 hover:bg-background/80 border border-transparent",
            disabled && "bg-muted/30 opacity-70"
        )}>
            {/* Dynamic Input Handles (stacked vertically) */}
            <div className="flex flex-col gap-1 -ml-2 mt-1">
                {dynamicHandles.map((h) => (
                    <NodePort.Input
                        key={h.id}
                        id={`${field.key}:${h.id}`}
                        connected={getHandleConnected(h.id)}
                    />
                ))}
            </div>

            {/* Field Info and Model Name */}
            <div className="flex-1 flex flex-col gap-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-muted-foreground truncate">
                        {field.label || field.key}
                    </span>
                    {selectedModel && (
                        <span className="text-[10px] font-medium text-foreground/80 bg-muted/80 px-2 py-0.5 rounded truncate max-w-[120px]">
                            {selectedModel.name}
                        </span>
                    )}
                </div>
                {/* Show connected handle labels */}
                {dynamicHandles.some(h => getHandleConnected(h.id)) && (
                    <div className="flex gap-1 flex-wrap">
                        {dynamicHandles.filter(h => getHandleConnected(h.id)).map(h => (
                            <span
                                key={h.id}
                                className="inline-flex items-center gap-1 text-[9px] text-blue-500 font-medium bg-blue-500/10 px-1.5 py-0.5 rounded-full"
                            >
                                <span className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
                                {h.label}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ============================================================================
// Widget Definition Export
// ============================================================================

export const ModelConfiguratorWidget: WidgetDefinition = {
    id: 'model-configurator',
    render: (props) => <InspectorComponent {...props} />,
    getInputHandles,
    renderFieldRow: (props) => <FieldRowComponent {...props} />,
};

// Backward compatibility export
export { InspectorComponent as ModelConfigurator };
