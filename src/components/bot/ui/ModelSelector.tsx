import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, AlertCircle, Settings } from 'lucide-react';
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
import { modelRegistry, ProviderType } from '@/features/models';
import { PROVIDER_INFO } from '@/features/models/providers';
import { useSettings, ProviderKey, isProviderConfigured } from '@/lib/settings';
import { hasAllCapabilities } from '@/features/models/utils';
import { openSettingsDialog } from '@/components/settings/SettingsDialog';
import { useTranslation } from 'react-i18next';

interface ModelSelectorProps {
    selectedModelId: string | null;
    onModelSelect: (modelId: string) => void;
    className?: string;
    disabled?: boolean;
}

export function ModelSelector({ selectedModelId, onModelSelect, className, disabled }: ModelSelectorProps) {
    const { t } = useTranslation('recipe');
    const [open, setOpen] = useState(false);
    const { settings } = useSettings();

    // Get configured providers
    const configuredProviders = useMemo(() => {
        const providers: ProviderType[] = [];
        if (settings) {
            const allProviderKeys = PROVIDER_INFO.map(p => p.key);
            allProviderKeys.forEach(key => {
                if (isProviderConfigured(settings, key as ProviderKey)) {
                    providers.push(key as ProviderType);
                }
            });
        }
        return providers;
    }, [settings]);

    // Get available chat models
    const models = useMemo(() => {
        // Get all LLMs
        let categoryModels = modelRegistry.getByCategory('llm');

        // Filter for chat capability
        categoryModels = categoryModels.filter(model =>
            hasAllCapabilities(model.id, ['chat'])
        );

        return categoryModels;
    }, []);

    const selectedModel = useMemo(() => {
        if (!selectedModelId) return null;
        return modelRegistry.get(selectedModelId);
    }, [selectedModelId]);

    const handleSelect = (modelId: string) => {
        onModelSelect(modelId);
        setOpen(false);
    };

    if (configuredProviders.length === 0) {
        return (
            <Button
                variant="ghost"
                size="sm"
                className={cn("h-6 gap-1.5 px-2 text-[10px] text-muted-foreground hover:text-foreground", className)}
                onClick={() => openSettingsDialog('models')}
            >
                <AlertCircle className="h-3 w-3" />
                <span>Configure Models</span>
            </Button>
        );
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    className={cn(
                        "h-6 gap-1.5 px-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors",
                        selectedModel && "text-foreground",
                        className
                    )}
                >
                    {selectedModel ? (
                        <>
                            <span>{selectedModel.name}</span>
                        </>
                    ) : (
                        <span>Select Model</span>
                    )}
                    <ChevronsUpDown className="h-3 w-3 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[240px] p-0" align="start" side="top">
                <Command>
                    <CommandInput placeholder="Search models..." className="h-8 text-xs" />
                    <CommandList>
                        <CommandEmpty>No models found.</CommandEmpty>
                        <CommandGroup>
                            {models.map((model) => {
                                const hasProvider = configuredProviders.includes(model.provider);
                                return (
                                    <CommandItem
                                        key={model.id}
                                        value={model.name}
                                        onSelect={() => handleSelect(model.id)}
                                        className={cn("text-xs py-1.5", !hasProvider && "opacity-50")}
                                        disabled={!hasProvider}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-3 w-3",
                                                selectedModelId === model.id ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <span className="truncate">{model.name}</span>
                                                <Badge
                                                    variant="outline"
                                                    className="text-[9px] px-1 py-0 h-4 font-normal text-muted-foreground border-border/50"
                                                >
                                                    {model.provider}
                                                </Badge>
                                            </div>
                                        </div>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
                <div className="p-1 border-t bg-muted/20">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-7 text-[10px] justify-start text-muted-foreground"
                        onClick={() => {
                            setOpen(false);
                            openSettingsDialog('models');
                        }}
                    >
                        <Settings className="h-3 w-3 mr-2" />
                        Manage Models...
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
