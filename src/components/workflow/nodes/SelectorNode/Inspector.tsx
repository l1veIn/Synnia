import { useAsset } from '@/hooks/useAsset';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Save, AlertCircle, Trash2, Edit, GripVertical } from 'lucide-react';
import { SelectorAssetContent, SelectorOption, DEFAULT_OPTION_SCHEMA } from './types';
import { SchemaBuilder } from '@/components/workflow/inspector/SchemaBuilder';
import { FormRenderer } from '@/components/workflow/inspector/FormRenderer';
import { FieldDefinition } from '@/types/assets';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { v4 as uuidv4 } from 'uuid';
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { AutoGenerateButton } from '@/components/ui/auto-generate-button';
import { useTranslation } from 'react-i18next';

interface InspectorProps {
    assetId: string;
    nodeId?: string;
}

export function Inspector({ assetId, nodeId }: InspectorProps) {
    const { t } = useTranslation('inspector');
    const { asset, setValue, updateConfig } = useAsset(assetId);

    // Get config from normalized structure: schema at top level, settings in extra
    const config = useMemo(() => {
        const cfg = (asset?.config as any) || {};
        const extra = cfg.extra || {};
        return {
            mode: extra.mode ?? 'multi' as 'single' | 'multi',
            showSearch: extra.showSearch ?? true,
            schema: cfg.schema ?? DEFAULT_OPTION_SCHEMA,
        };
    }, [asset?.config]);

    const options: SelectorOption[] = useMemo(() => {
        const raw = asset?.value;
        if (Array.isArray(raw)) {
            return raw.map((item: any, i: number) => ({
                id: item.id || `opt-${i}`,
                ...item,
            }));
        }
        return [];
    }, [asset?.value]);

    // For backward compatibility with savedContent usage in existing code
    const savedContent: SelectorAssetContent = useMemo(() => ({
        mode: config.mode,
        showSearch: config.showSearch,
        schema: config.schema,
        options,
        selected: [],  // Selected is now in node.data, not asset
    }), [config, options]);

    // Draft state for settings
    const [draftMode, setDraftMode] = useState<'single' | 'multi'>('multi');
    const [draftShowSearch, setDraftShowSearch] = useState(true);
    const [draftSchema, setDraftSchema] = useState<FieldDefinition[]>([]);
    const [isInitialized, setIsInitialized] = useState(false);

    // Option editor dialog state
    const [isOptionDialogOpen, setIsOptionDialogOpen] = useState(false);
    const [editingOption, setEditingOption] = useState<SelectorOption | null>(null);
    const [draftOptionValues, setDraftOptionValues] = useState<Record<string, any>>({});

    // Initialize draft from saved
    useEffect(() => {
        if (!isInitialized && asset) {
            setDraftMode(savedContent.mode);
            setDraftShowSearch(savedContent.showSearch);
            setDraftSchema(savedContent.schema);
            setIsInitialized(true);
        }
    }, [savedContent, isInitialized, asset]);

    // Reset on asset change
    useEffect(() => {
        setDraftMode(savedContent.mode);
        setDraftShowSearch(savedContent.showSearch);
        setDraftSchema(savedContent.schema);
        setIsInitialized(true);
    }, [assetId]);

    // Check for settings changes
    const hasSettingsChanges = useMemo(() => {
        if (!isInitialized) return false;
        return draftMode !== savedContent.mode ||
            draftShowSearch !== savedContent.showSearch ||
            JSON.stringify(draftSchema) !== JSON.stringify(savedContent.schema);
    }, [draftMode, draftShowSearch, draftSchema, savedContent, isInitialized]);

    // Save settings - schema at top level, mode/showSearch in extra
    const handleSaveSettings = () => {
        const currentConfig = asset?.config as any || {};
        updateConfig({
            ...currentConfig,
            schema: draftSchema,
            extra: {
                mode: draftMode,
                showSearch: draftShowSearch,
            },
        });
        toast.success(t('changesSaved'));
    };

    // Discard settings
    const handleDiscardSettings = () => {
        setDraftMode(savedContent.mode);
        setDraftShowSearch(savedContent.showSearch);
        setDraftSchema(savedContent.schema);
        toast.info(t('changesDiscarded'));
    };

    // Add new option
    const handleAddOption = () => {
        const newOption: SelectorOption = { id: uuidv4() };
        // Set defaults from schema
        savedContent.schema.forEach(field => {
            newOption[field.key] = field.defaultValue ?? '';
        });
        setEditingOption(newOption);
        setDraftOptionValues(newOption);
        setIsOptionDialogOpen(true);
    };

    // Edit existing option
    const handleEditOption = (optionId: string) => {
        const option = options.find(o => o.id === optionId);
        if (option) {
            setEditingOption(option);
            setDraftOptionValues({ ...option });
            setIsOptionDialogOpen(true);
        }
    };

    // Delete option - saves only options array to asset.value
    const handleDeleteOption = (optionId: string) => {
        const newOptions = options.filter(o => o.id !== optionId);
        setValue(newOptions);
        toast.success(t('selector.optionDeleted'));
    };

    // Save option from dialog - saves only options array to asset.value
    const handleSaveOption = () => {
        if (!editingOption) return;

        const updatedOption = { ...draftOptionValues, id: editingOption.id };
        const exists = options.some(o => o.id === editingOption.id);

        let newOptions: SelectorOption[];
        if (exists) {
            newOptions = options.map(o =>
                o.id === editingOption.id ? updatedOption : o
            );
        } else {
            newOptions = [...options, updatedOption];
        }

        setValue(newOptions);
        setIsOptionDialogOpen(false);
        setEditingOption(null);
        toast.success(exists ? t('selector.optionUpdated') : t('selector.optionAdded'));
    };

    // Get display label for an option
    const getOptionLabel = (option: SelectorOption): string => {
        for (const field of savedContent.schema) {
            if (field.type === 'string' && option[field.key]) {
                return String(option[field.key]);
            }
        }
        return option.id.slice(0, 8);
    };

    if (!asset) return <div className="p-4 text-xs">{t('assetNotFound')}</div>;

    return (
        <div className="flex flex-col h-full">
            <Tabs defaultValue="options" className="flex-1 flex flex-col min-h-0">
                <TabsList className="mx-4 mt-3 shrink-0">
                    <TabsTrigger value="options" className="flex-1 text-xs">{t('selector.options')}</TabsTrigger>
                    <TabsTrigger value="schema" className="flex-1 text-xs">{t('form.schema')}</TabsTrigger>
                    <TabsTrigger value="settings" className="flex-1 text-xs">{t('selector.settings')}</TabsTrigger>
                </TabsList>

                {/* Options Tab */}
                <TabsContent value="options" className="flex-1 flex flex-col min-h-0 m-0">
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {/* Add buttons */}
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={handleAddOption}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                {t('selector.addOption')}
                            </Button>
                            <AutoGenerateButton
                                mode="table-full"
                                count={30}
                                onGenerate={(result) => {
                                    // Map table-full result to selector format
                                    const { columns, rows } = result;
                                    const newSchema = columns.map((c: any) => ({
                                        id: c.key,
                                        key: c.key,
                                        label: c.label,
                                        type: c.type || 'string',
                                    }));
                                    const newOptions = rows.map((r: any, idx: number) => ({
                                        id: uuidv4(),
                                        ...r,
                                    }));
                                    setDraftSchema(newSchema);
                                    updateConfig({ schema: newSchema });
                                    setValue([...options, ...newOptions]);
                                    toast.success(t('selector.addedOptions', { count: newOptions.length }));
                                }}
                                placeholder="Describe the selector options (e.g., 'color options with name and hex code')..."
                                buttonLabel="+ Generate"
                                buttonVariant="outline"
                                buttonSize="default"
                            />
                        </div>

                        {/* Options list */}
                        <div className="space-y-1">
                            {options.length === 0 ? (
                                <div className="text-xs text-muted-foreground text-center py-8 border rounded-md border-dashed">
                                    {t('selector.noOptions')}
                                </div>
                            ) : (
                                options.map((option, idx) => (
                                    <div
                                        key={option.id}
                                        className="flex items-center gap-2 p-2 border rounded-md bg-muted/30 hover:bg-muted/50"
                                    >
                                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab shrink-0" />
                                        <span className="text-xs flex-1 truncate">{getOptionLabel(option)}</span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0"
                                            onClick={() => handleEditOption(option.id)}
                                        >
                                            <Edit className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0 hover:text-destructive"
                                            onClick={() => handleDeleteOption(option.id)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Selection info */}
                        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                            {t('selector.selectedOf', { selected: 0, total: options.length })}
                        </div>
                    </div>
                </TabsContent>

                {/* Schema Tab */}
                <TabsContent value="schema" className="flex-1 flex flex-col min-h-0 m-0">
                    <div className="flex-1 overflow-y-auto p-4">
                        <SchemaBuilder
                            schema={draftSchema}
                            onChange={setDraftSchema}
                        />
                    </div>
                </TabsContent>

                {/* Settings Tab */}
                <TabsContent value="settings" className="flex-1 flex flex-col min-h-0 m-0">
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {/* Mode */}
                        <div className="space-y-2">
                            <Label className="text-xs">{t('selector.selectionMode')}</Label>
                            <div className="flex gap-2">
                                <Button
                                    variant={draftMode === 'single' ? 'secondary' : 'ghost'}
                                    size="sm"
                                    className="flex-1 h-8 text-xs"
                                    onClick={() => setDraftMode('single')}
                                >
                                    {t('selector.single')}
                                </Button>
                                <Button
                                    variant={draftMode === 'multi' ? 'secondary' : 'ghost'}
                                    size="sm"
                                    className="flex-1 h-8 text-xs"
                                    onClick={() => setDraftMode('multi')}
                                >
                                    {t('selector.multiple')}
                                </Button>
                            </div>
                        </div>

                        {/* Show Search */}
                        <div className="flex items-center justify-between">
                            <Label className="text-xs">{t('selector.showSearch')}</Label>
                            <Switch checked={draftShowSearch} onCheckedChange={setDraftShowSearch} />
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Fixed Footer */}
            <div className="px-4 py-3 border-t bg-muted/10 flex items-center justify-between shrink-0">
                <div className="text-[10px] text-muted-foreground font-mono">
                    {hasSettingsChanges && (
                        <span className="text-amber-600 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {t('form.unsaved')}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {hasSettingsChanges && (
                        <Button size="sm" variant="ghost" onClick={handleDiscardSettings} className="h-7 text-xs">
                            {t('form.discard')}
                        </Button>
                    )}
                    <Button
                        size="sm"
                        variant={hasSettingsChanges ? "default" : "outline"}
                        onClick={handleSaveSettings}
                        className={cn("h-7 gap-1.5", hasSettingsChanges && "bg-primary")}
                        disabled={!hasSettingsChanges}
                    >
                        <Save className="h-3.5 w-3.5" />
                        {t('form.save')}
                    </Button>
                </div>
            </div>

            {/* Option Editor Dialog */}
            <Dialog open={isOptionDialogOpen} onOpenChange={setIsOptionDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {editingOption && options.some(o => o.id === editingOption.id)
                                ? t('selector.editOption')
                                : t('selector.addOption')
                            }
                        </DialogTitle>
                    </DialogHeader>

                    <div className="py-4">
                        <FormRenderer
                            schema={savedContent.schema}
                            values={draftOptionValues}
                            onChange={setDraftOptionValues}
                        />
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsOptionDialogOpen(false)}>
                            {t('actions.cancel', { ns: 'common' })}
                        </Button>
                        <Button onClick={handleSaveOption}>
                            {t('form.save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
