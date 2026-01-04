/**
 * ModelTab - Model configuration for Recipe nodes
 * Uses the same logic as ModelConfigurator widget
 */

import { useState, useMemo, useEffect } from 'react';
import { Check, ChevronsUpDown, AlertCircle, Thermometer, Hash, FileJson, Key, Settings } from 'lucide-react';
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
import { modelRegistry, ModelCategory, ProviderType } from '@features/models';
import { useSettings, ProviderKey, isProviderConfigured, getDefaultModel } from '@/lib/settings';
import type { ModelConfig } from '@/features/recipes/types';
import type { ModelCapability } from '@features/models/types';
import { hasAllCapabilities } from '@features/models/utils';
import { openSettingsDialog } from '@/components/settings/SettingsDialog';

export interface ModelTabProps {
    modelConfig?: ModelConfig;
    onModelConfigChange: (config: ModelConfig) => void;
    filterCategory?: string; // e.g., 'llm', 'llm-chat', 'image-generation'
    /** Required capabilities from recipe - only show models with these capabilities */
    requiredCapabilities?: ModelCapability[];
}

// ============================================================================
// Default LLM Settings Component (same as ModelConfigurator)
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
// ModelTab Component
// ============================================================================

export function ModelTab({ modelConfig, onModelConfigChange, filterCategory = 'llm', requiredCapabilities = [] }: ModelTabProps) {
    const [open, setOpen] = useState(false);
    const { settings, setDefaultModel } = useSettings();

    const isLLMCategory = filterCategory?.startsWith('llm-') || filterCategory === 'llm';

    // Get available models for this category, filtered by required capabilities
    const models = useMemo(() => {
        let categoryModels = isLLMCategory
            ? modelRegistry.getByCategory('llm')
            : modelRegistry.getByCategory(filterCategory as ModelCategory);

        // Filter by required capabilities if specified
        if (requiredCapabilities.length > 0) {
            categoryModels = categoryModels.filter(model =>
                hasAllCapabilities(model.id, requiredCapabilities)
            );
        }

        return categoryModels;
    }, [filterCategory, isLLMCategory, requiredCapabilities]);

    // Current selected model
    const selectedModel = useMemo(() => {
        if (!modelConfig?.modelId) return null;
        return modelRegistry.get(modelConfig.modelId);
    }, [modelConfig?.modelId]);

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
        const providers = selectedModel.supportedProviders || [selectedModel.provider];
        return providers.filter(p => configuredProviders.includes(p));
    }, [selectedModel, configuredProviders]);

    // Auto-select default model if none selected
    useEffect(() => {
        if (!modelConfig?.modelId && settings && models.length > 0) {
            const category = filterCategory || 'llm';
            const defaultModelId = getDefaultModel(settings, category);

            let modelToSelect = defaultModelId
                ? models.find(m => m.id === defaultModelId)
                : null;

            if (!modelToSelect) {
                modelToSelect = models.find(m =>
                    (m.supportedProviders || [m.provider]).some(p => configuredProviders.includes(p))
                );
            }

            if (modelToSelect) {
                const providers = modelToSelect.supportedProviders || [modelToSelect.provider];
                const availableProvider = providers.find(p => configuredProviders.includes(p));
                onModelConfigChange({
                    modelId: modelToSelect.id,
                    provider: availableProvider,
                    params: {},
                });
            }
        }
    }, [modelConfig?.modelId, settings, models, configuredProviders, filterCategory]);

    // Handle model selection
    const handleModelSelect = async (modelId: string) => {
        const model = modelRegistry.get(modelId);
        if (!model) return;

        const providers = model.supportedProviders || [model.provider];
        const availableProvider = providers.find(p => configuredProviders.includes(p));

        onModelConfigChange({
            modelId,
            provider: availableProvider,
            params: {},
        });
        setOpen(false);

        // Update default model for this category
        const category = filterCategory || model.category;
        if (category) {
            await setDefaultModel(category, modelId);
        }
    };

    // Handle config change
    const handleParamsChange = (params: any) => {
        if (!modelConfig) return;
        onModelConfigChange({ ...modelConfig, params });
    };

    return (
        <div className="model-tab p-4 space-y-4">
            {/* Empty state when no providers configured */}
            {configuredProviders.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Key className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-sm font-medium mb-1">No API Keys Configured</h3>
                    <p className="text-xs text-muted-foreground mb-4 max-w-[200px]">
                        Add your API keys for AI providers like OpenAI, Google, or Anthropic to get started.
                    </p>
                    <Button
                        size="sm"
                        onClick={() => openSettingsDialog('models')}
                    >
                        <Settings className="h-4 w-4 mr-2" />
                        Open Settings
                    </Button>
                </div>
            )}

            {configuredProviders.length > 0 && (
                <>
                    {/* Model Selector */}
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={open}
                                className="w-full justify-between h-9 text-xs bg-background"
                            >
                                {selectedModel ? (
                                    <div className="flex items-center gap-2 truncate">
                                        <Badge
                                            variant="secondary"
                                            className="px-1 py-0 h-5 text-[10px] uppercase font-normal text-muted-foreground"
                                        >
                                            {modelConfig?.provider || (selectedModel.supportedProviders || [selectedModel.provider])[0]}
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
                                            const hasProvider = (model.supportedProviders || [model.provider]).some(p =>
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
                                                            modelConfig?.modelId === model.id ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    <div className="flex flex-col gap-0.5">
                                                        <span>{model.name}</span>
                                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                            {(model.supportedProviders || [model.provider]).map(p => (
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
                                需要配置 {(selectedModel.supportedProviders || [selectedModel.provider]).join(' 或 ')} 的 API Key
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Model's config UI */}
                    {selectedModel && availableProviders.length > 0 && (
                        <>
                            {selectedModel.renderConfig ? (
                                // Model has custom config UI
                                selectedModel.renderConfig({
                                    value: modelConfig?.params,
                                    onChange: handleParamsChange,
                                    disabled: false,
                                    availableProviders,
                                })
                            ) : isLLMCategory ? (
                                // LLM model without custom config: use default settings
                                <DefaultLLMSettings
                                    value={modelConfig?.params}
                                    onChange={handleParamsChange}
                                    disabled={false}
                                    defaultTemperature={(selectedModel as any).defaultTemperature}
                                    maxOutputTokens={(selectedModel as any).maxOutputTokens}
                                    capabilities={(selectedModel as any).capabilities}
                                />
                            ) : null}
                        </>
                    )}
                </>
            )}
        </div>
    );
}
