import { useAsset } from '@/presentation/hooks/useAsset';
import { Button } from '@/presentation/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/presentation/components/ui/tabs';
import { Save, AlertCircle } from 'lucide-react';
import { DEFAULT_OPTION_SCHEMA, ViewMode, FieldMapping, CardLayoutConfig, DEFAULT_CARD_LAYOUT, detectFieldMapping } from './types';
import type { SelectorOption } from './types';
import { FormRenderer } from '@/presentation/components/workflow/inspector/FormRenderer';
import { FieldDefinition } from '@/domain/asset/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/presentation/components/ui/dialog';
import { v4 as uuidv4 } from 'uuid';
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { OptionsTab, SchemaTab, SettingsTab } from './Inspector/index';
import type { SelectorInspectorContext } from './Inspector/types';

interface InspectorProps {
    assetId: string;
    nodeId?: string;
}

export function Inspector({ assetId, nodeId }: InspectorProps) {
    const { t } = useTranslation('inspector');
    const { asset, setValue, updateConfig } = useAsset(assetId);

    // Get config from normalized structure
    const config = useMemo(() => {
        const cfg = (asset?.config as any) || {};
        const extra = cfg.extra || {};
        const schema = cfg.schema ?? DEFAULT_OPTION_SCHEMA;
        const detectedMapping = detectFieldMapping(schema);

        return {
            mode: extra.mode ?? 'multi' as 'single' | 'multi',
            viewMode: extra.viewMode ?? 'list' as ViewMode,
            showSearch: extra.showSearch ?? true,
            showBulkActions: extra.showBulkActions ?? false,
            schema,
            fieldMapping: { ...detectedMapping, ...extra.fieldMapping } as FieldMapping,
            cardLayout: { ...DEFAULT_CARD_LAYOUT, ...extra.cardLayout } as CardLayoutConfig,
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

    // Draft state for settings
    const [draftMode, setDraftMode] = useState<'single' | 'multi'>('multi');
    const [draftViewMode, setDraftViewMode] = useState<ViewMode>('list');
    const [draftShowSearch, setDraftShowSearch] = useState(true);
    const [draftShowBulkActions, setDraftShowBulkActions] = useState(false);
    const [draftFieldMapping, setDraftFieldMapping] = useState<Partial<FieldMapping>>({});
    const [draftCardLayout, setDraftCardLayout] = useState<Partial<CardLayoutConfig>>({});
    const [draftSchema, setDraftSchema] = useState<FieldDefinition[]>([]);
    const [isInitialized, setIsInitialized] = useState(false);

    // Option editor dialog state
    const [isOptionDialogOpen, setIsOptionDialogOpen] = useState(false);
    const [editingOption, setEditingOption] = useState<SelectorOption | null>(null);
    const [draftOptionValues, setDraftOptionValues] = useState<Record<string, any>>({});

    // Initialize draft from saved
    useEffect(() => {
        if (!isInitialized && asset) {
            setDraftMode(config.mode);
            setDraftViewMode(config.viewMode);
            setDraftShowSearch(config.showSearch);
            setDraftShowBulkActions(config.showBulkActions);
            setDraftFieldMapping(config.fieldMapping);
            setDraftCardLayout(config.cardLayout);
            setDraftSchema(config.schema);
            setIsInitialized(true);
        }
    }, [config, isInitialized, asset]);

    // Reset on asset change
    useEffect(() => {
        setDraftMode(config.mode);
        setDraftViewMode(config.viewMode);
        setDraftShowSearch(config.showSearch);
        setDraftShowBulkActions(config.showBulkActions);
        setDraftFieldMapping(config.fieldMapping);
        setDraftCardLayout(config.cardLayout);
        setDraftSchema(config.schema);
        setIsInitialized(true);
    }, [assetId]);

    // Check for settings changes
    const hasSettingsChanges = useMemo(() => {
        if (!isInitialized) return false;
        return draftMode !== config.mode ||
            draftViewMode !== config.viewMode ||
            draftShowSearch !== config.showSearch ||
            draftShowBulkActions !== config.showBulkActions ||
            JSON.stringify(draftFieldMapping) !== JSON.stringify(config.fieldMapping) ||
            JSON.stringify(draftCardLayout) !== JSON.stringify(config.cardLayout) ||
            JSON.stringify(draftSchema) !== JSON.stringify(config.schema);
    }, [draftMode, draftViewMode, draftShowSearch, draftShowBulkActions, draftFieldMapping, draftCardLayout, draftSchema, config, isInitialized]);

    // Save settings
    const handleSaveSettings = () => {
        const currentConfig = asset?.config as any || {};
        updateConfig({
            ...currentConfig,
            schema: draftSchema,
            extra: {
                ...currentConfig.extra,
                mode: draftMode,
                viewMode: draftViewMode,
                showSearch: draftShowSearch,
                showBulkActions: draftShowBulkActions,
                fieldMapping: draftFieldMapping,
                cardLayout: draftCardLayout,
            },
        });
        toast.success(t('changesSaved'));
    };

    // Discard settings
    const handleDiscardSettings = () => {
        setDraftMode(config.mode);
        setDraftViewMode(config.viewMode);
        setDraftShowSearch(config.showSearch);
        setDraftShowBulkActions(config.showBulkActions);
        setDraftFieldMapping(config.fieldMapping);
        setDraftCardLayout(config.cardLayout);
        setDraftSchema(config.schema);
        toast.info(t('changesDiscarded'));
    };

    // Option handlers
    const handleAddOption = () => {
        const newOption: SelectorOption = { id: uuidv4() };
        config.schema.forEach((field: FieldDefinition) => {
            newOption[field.key] = field.defaultValue ?? '';
        });
        setEditingOption(newOption);
        setDraftOptionValues(newOption);
        setIsOptionDialogOpen(true);
    };

    const handleEditOption = (optionId: string) => {
        const option = options.find(o => o.id === optionId);
        if (option) {
            setEditingOption(option);
            setDraftOptionValues({ ...option });
            setIsOptionDialogOpen(true);
        }
    };

    const handleDeleteOption = (optionId: string) => {
        const newOptions = options.filter(o => o.id !== optionId);
        setValue(newOptions);
        toast.success(t('selector.optionDeleted'));
    };

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

    const getOptionLabel = (option: SelectorOption): string => {
        for (const field of config.schema) {
            if (field.type === 'string' && option[field.key]) {
                return String(option[field.key]);
            }
        }
        return option.id.slice(0, 8);
    };

    if (!asset) return <div className="p-4 text-xs">{t('assetNotFound')}</div>;

    // Build context for tab components
    const ctx: SelectorInspectorContext = {
        options,
        schema: config.schema,
        draftMode, setDraftMode,
        draftViewMode, setDraftViewMode,
        draftShowSearch, setDraftShowSearch,
        draftShowBulkActions, setDraftShowBulkActions,
        draftFieldMapping, setDraftFieldMapping,
        draftCardLayout, setDraftCardLayout,
        draftSchema, setDraftSchema,
        setValue,
        updateConfig,
        onAddOption: handleAddOption,
        onEditOption: handleEditOption,
        onDeleteOption: handleDeleteOption,
        getOptionLabel,
    };

    return (
        <div className="flex flex-col h-full">
            <Tabs defaultValue="options" className="flex-1 flex flex-col min-h-0">
                <TabsList className="mx-4 mt-3 shrink-0">
                    <TabsTrigger value="options" className="flex-1 text-xs">{t('selector.options')}</TabsTrigger>
                    <TabsTrigger value="schema" className="flex-1 text-xs">{t('form.schema')}</TabsTrigger>
                    <TabsTrigger value="settings" className="flex-1 text-xs">{t('selector.settings')}</TabsTrigger>
                </TabsList>

                <TabsContent value="options" className="flex-1 flex flex-col min-h-0 m-0">
                    <OptionsTab ctx={ctx} />
                </TabsContent>

                <TabsContent value="schema" className="flex-1 flex flex-col min-h-0 m-0">
                    <SchemaTab ctx={ctx} />
                </TabsContent>

                <TabsContent value="settings" className="flex-1 flex flex-col min-h-0 m-0">
                    <SettingsTab ctx={ctx} />
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
                            schema={config.schema}
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
