// Simplified ModelConfigurator
// Just selects a model and delegates rendering to the model plugin

import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, AlertCircle } from 'lucide-react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getModel, getModelsForCategory, ModelCategory, ProviderType } from '@/lib/models';
import { useSettings, ProviderKey, isProviderConfigured } from '@/lib/settings';

// Return type of the configurator
export interface ModelConfigValue {
    modelId: string;
    provider?: ProviderType;
    config: any;  // Model-specific config
}

interface ModelConfiguratorProps {
    value?: ModelConfigValue;
    onChange: (value: ModelConfigValue) => void;
    disabled?: boolean;
    filterCategory?: string;  // Filter by category (from recipe YAML)
}

export function ModelConfigurator({ value, onChange, disabled, filterCategory }: ModelConfiguratorProps) {
    const [open, setOpen] = useState(false);
    const { settings } = useSettings();

    // Get available models for this category
    const models = useMemo(() => {
        if (filterCategory) {
            return getModelsForCategory(filterCategory as ModelCategory);
        }
        return getModelsForCategory('text-to-image');
    }, [filterCategory]);

    // Current selected model
    const selectedModel = useMemo(() => {
        if (!value?.modelId) return null;
        return getModel(value.modelId);
    }, [value?.modelId]);

    // Get providers user has configured
    const configuredProviders = useMemo(() => {
        const providers: ProviderType[] = [];
        if (settings) {
            // Check each provider type
            const allProviderKeys: ProviderKey[] = ['openai', 'anthropic', 'google', 'fal', 'replicate', 'deepseek', 'ollama', 'comfyui'];
            allProviderKeys.forEach(key => {
                if (isProviderConfigured(settings, key)) {
                    providers.push(key as ProviderType);
                }
            });
        }
        return providers;
    }, [settings]);

    // Available providers for current model (intersection of supported and configured)
    const availableProviders = useMemo(() => {
        if (!selectedModel) return [];
        return selectedModel.supportedProviders.filter(p => configuredProviders.includes(p));
    }, [selectedModel, configuredProviders]);

    // Handle model selection
    const handleModelSelect = (modelId: string) => {
        const model = getModel(modelId);
        if (!model) return;

        // Find first available provider
        const availableProvider = model.supportedProviders.find(p => configuredProviders.includes(p));

        onChange({
            modelId,
            provider: availableProvider,
            config: {},
        });
        setOpen(false);
    };

    // Handle config change (from model's renderConfig)
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

            {/* Model's own config UI */}
            {selectedModel && availableProviders.length > 0 && (
                selectedModel.renderConfig({
                    value: value?.config,
                    onChange: handleConfigChange,
                    disabled,
                    availableProviders,
                })
            )}
        </div>
    );
}
