/**
 * ModelTab - Model configuration for Recipe nodes
 * Uses the same logic as ModelConfigurator widget
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import { Check, ChevronsUpDown, AlertCircle, Thermometer, Hash, FileJson, Key, Settings, Save } from 'lucide-react';
import { toast } from 'sonner';
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
import { PROVIDER_INFO } from '@features/models/providers';
import { useSettings, ProviderKey, isProviderConfigured, getDefaultModel } from '@/lib/settings';
import type { ModelConfig } from '@/features/recipes/types';
import type { ModelCapability } from '@features/models/types';
import { hasAllCapabilities } from '@features/models/utils';
import { openSettingsDialog } from '@/components/settings/SettingsDialog';
import { useTranslation } from 'react-i18next';

export interface ModelTabProps {
    modelConfig?: ModelConfig;
    onModelConfigChange: (config: ModelConfig) => void;
    filterCategory?: string; // e.g., 'llm', 'image-generation', 'video-generation'
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
    const { t } = useTranslation('recipe');
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
                        {t('model.temperature')}
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
                        {t('model.maxTokens')}
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
                        {t('model.jsonMode')}
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
    const { t } = useTranslation('recipe');
    const [open, setOpen] = useState(false);
    const { settings, setDefaultModel } = useSettings();

    const isLLMCategory = filterCategory?.startsWith('llm-') || filterCategory === 'llm';

    // ========================================================================
    // Draft Mode: Local state for unsaved changes
    // ========================================================================
    const [draftConfig, setDraftConfig] = useState<ModelConfig | undefined>(modelConfig);
    const [isInitialized, setIsInitialized] = useState(false);

    // Sync draft with saved config when it changes externally (e.g., different node selected)
    useEffect(() => {
        if (!isInitialized) {
            setDraftConfig(modelConfig);
            setIsInitialized(true);
        }
    }, [modelConfig, isInitialized]);

    // Reset initialization when modelConfig identity changes (different asset)
    const prevModelConfigRef = useRef<ModelConfig | undefined>(undefined);
    useEffect(() => {
        // Detect if this is a different config (different asset selected)
        const isDifferentConfig = modelConfig?.modelId !== prevModelConfigRef.current?.modelId ||
            modelConfig?.provider !== prevModelConfigRef.current?.provider;
        if (isDifferentConfig) {
            prevModelConfigRef.current = modelConfig;
            setDraftConfig(modelConfig);
        }
    }, [modelConfig]);

    // Check if there are unsaved changes
    const hasChanges = useMemo(() => {
        return JSON.stringify(draftConfig) !== JSON.stringify(modelConfig);
    }, [draftConfig, modelConfig]);

    // ========================================================================

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

    // Current selected model (from draft)
    const selectedModel = useMemo(() => {
        if (!draftConfig?.modelId) return null;
        return modelRegistry.get(draftConfig.modelId);
    }, [draftConfig?.modelId]);

    // Get providers user has configured
    const configuredProviders = useMemo(() => {
        const providers: ProviderType[] = [];
        if (settings) {
            // Dynamically get all provider keys from PROVIDER_INFO
            const allProviderKeys = PROVIDER_INFO.map(p => p.key);
            allProviderKeys.forEach(key => {
                if (isProviderConfigured(settings, key as ProviderKey)) {
                    providers.push(key as ProviderType);
                }
            });
        }
        return providers;
    }, [settings]);

    // Check if selected model's provider is configured
    const isProviderAvailable = useMemo(() => {
        if (!selectedModel) return false;
        return configuredProviders.includes(selectedModel.provider);
    }, [selectedModel, configuredProviders]);

    // Handle model selection (update draft only)
    const handleModelSelect = async (modelId: string) => {
        const model = modelRegistry.get(modelId);
        if (!model) return;

        setDraftConfig({
            modelId,
            provider: model.provider,
            params: {},
        });
        setOpen(false);

        // Update default model for this category
        const category = filterCategory || model.category;
        if (category && category != 'llm') {
            await setDefaultModel(category, modelId);
        }
    };



    // Handle config change (update draft only)
    const handleParamsChange = (params: any) => {
        if (!draftConfig) return;
        setDraftConfig({ ...draftConfig, params });
    };

    // Save draft to asset
    const handleSave = () => {
        if (draftConfig) {
            onModelConfigChange(draftConfig);
            toast.success('Model configuration saved');
        }
    };

    // Discard changes
    const handleDiscard = () => {
        setDraftConfig(modelConfig);
        toast.info('Changes discarded');
    };

    return (
        <div className="model-tab p-4 space-y-4">
            {/* Empty state when no providers configured */}
            {configuredProviders.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Key className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-sm font-medium mb-1">{t('model.noApiKeys')}</h3>
                    <p className="text-xs text-muted-foreground mb-4 max-w-[200px]">
                        {t('model.addKeysDesc')}
                    </p>
                    <Button
                        size="sm"
                        onClick={() => openSettingsDialog('models')}
                    >
                        <Settings className="h-4 w-4 mr-2" />
                        {t('model.openSettings')}
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
                                            {selectedModel.provider}
                                        </Badge>
                                        <span className="truncate">{selectedModel.name}</span>
                                    </div>
                                ) : (
                                    <span className="text-muted-foreground">{t('model.selectModel')}</span>
                                )}
                                <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[280px] p-0" align="start">
                            <Command>
                                <CommandInput placeholder={t('model.searchModels')} className="h-8 text-xs" />
                                <CommandList>
                                    <CommandEmpty>{t('model.noModelsFound')}</CommandEmpty>
                                    <CommandGroup heading={t('model.availableModels')}>
                                        {models.map((model) => {
                                            const hasProvider = configuredProviders.includes(model.provider);
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
                                                        <div className="flex items-center gap-1.5">
                                                            <span>{model.name}</span>
                                                            <span className={cn(
                                                                "text-[10px] uppercase px-1 py-0.5 rounded",
                                                                hasProvider ? "text-green-500" : "text-muted-foreground/50"
                                                            )}>
                                                                {model.provider}
                                                            </span>
                                                        </div>
                                                        {model.description && (
                                                            <span className="text-[10px] text-muted-foreground">
                                                                {model.description}
                                                            </span>
                                                        )}
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
                    {selectedModel && !isProviderAvailable && (
                        <Alert variant="destructive" className="py-2">
                            <AlertCircle className="h-3 w-3" />
                            <AlertDescription className="text-xs">
                                {t('model.needApiKey', { providers: selectedModel.provider })}
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Model's config UI */}
                    {selectedModel && isProviderAvailable && (
                        <>
                            {selectedModel.renderConfig ? (
                                // Model has custom config UI
                                selectedModel.renderConfig({
                                    value: draftConfig?.params,
                                    onChange: handleParamsChange,
                                    disabled: false,
                                    availableProviders: [selectedModel.provider],
                                    provider: selectedModel.provider,
                                })
                            ) : isLLMCategory ? (
                                // LLM model without custom config: use default settings
                                <DefaultLLMSettings
                                    value={draftConfig?.params}
                                    onChange={handleParamsChange}
                                    disabled={false}
                                    defaultTemperature={(selectedModel as any).defaultTemperature}
                                    maxOutputTokens={(selectedModel as any).maxOutputTokens}
                                    capabilities={(selectedModel as any).capabilities}
                                />
                            ) : null}
                        </>
                    )}

                    {/* Save/Discard Footer */}
                    <div className="pt-4 border-t flex items-center justify-end gap-2">
                        {hasChanges && (
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleDiscard}
                                className="h-7 text-xs"
                            >
                                {t('model.discard')}
                            </Button>
                        )}
                        <Button
                            size="sm"
                            variant={hasChanges ? "default" : "outline"}
                            onClick={handleSave}
                            className={cn("h-7 gap-1.5", hasChanges && "bg-primary")}
                            disabled={!hasChanges}
                        >
                            <Save className="h-3.5 w-3.5" />
                            {t('model.save')}
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
}
