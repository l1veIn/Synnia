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

interface InspectorProps {
    assetId: string;
    nodeId?: string;
}

export function Inspector({ assetId, nodeId }: InspectorProps) {
    const { asset, setValue, updateConfig } = useAsset(assetId);

    // Get config and options from the new clean data model
    const config = useMemo(() => {
        const cfg = (asset?.config as any) || {};
        return {
            mode: cfg.mode ?? 'multi' as 'single' | 'multi',
            showSearch: cfg.showSearch ?? true,
            optionSchema: cfg.optionSchema ?? DEFAULT_OPTION_SCHEMA,
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
        optionSchema: config.optionSchema,
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
            setDraftSchema(savedContent.optionSchema);
            setIsInitialized(true);
        }
    }, [savedContent, isInitialized, asset]);

    // Reset on asset change
    useEffect(() => {
        setDraftMode(savedContent.mode);
        setDraftShowSearch(savedContent.showSearch);
        setDraftSchema(savedContent.optionSchema);
        setIsInitialized(true);
    }, [assetId]);

    // Check for settings changes
    const hasSettingsChanges = useMemo(() => {
        if (!isInitialized) return false;
        return draftMode !== savedContent.mode ||
            draftShowSearch !== savedContent.showSearch ||
            JSON.stringify(draftSchema) !== JSON.stringify(savedContent.optionSchema);
    }, [draftMode, draftShowSearch, draftSchema, savedContent, isInitialized]);

    // Save settings - uses updateConfig for config values
    const handleSaveSettings = () => {
        updateConfig({
            mode: draftMode,
            showSearch: draftShowSearch,
            optionSchema: draftSchema,
        });
        toast.success('Settings saved');
    };

    // Discard settings
    const handleDiscardSettings = () => {
        setDraftMode(savedContent.mode);
        setDraftShowSearch(savedContent.showSearch);
        setDraftSchema(savedContent.optionSchema);
        toast.info('Changes discarded');
    };

    // Add new option
    const handleAddOption = () => {
        const newOption: SelectorOption = { id: uuidv4() };
        // Set defaults from schema
        savedContent.optionSchema.forEach(field => {
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
        toast.success('Option deleted');
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
        toast.success(exists ? 'Option updated' : 'Option added');
    };

    // Get display label for an option
    const getOptionLabel = (option: SelectorOption): string => {
        for (const field of savedContent.optionSchema) {
            if (field.type === 'string' && option[field.key]) {
                return String(option[field.key]);
            }
        }
        return option.id.slice(0, 8);
    };

    if (!asset) return <div className="p-4 text-xs">Asset Not Found</div>;

    return (
        <div className="flex flex-col h-full">
            <Tabs defaultValue="options" className="flex-1 flex flex-col min-h-0">
                <TabsList className="mx-4 mt-3 shrink-0">
                    <TabsTrigger value="options" className="flex-1 text-xs">Options</TabsTrigger>
                    <TabsTrigger value="schema" className="flex-1 text-xs">Schema</TabsTrigger>
                    <TabsTrigger value="settings" className="flex-1 text-xs">Settings</TabsTrigger>
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
                                Add Option
                            </Button>
                            <AutoGenerateButton
                                mode="table-full"
                                count={5}
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
                                    updateConfig({ optionSchema: newSchema });
                                    setValue([...options, ...newOptions]);
                                    toast.success(`Added ${newOptions.length} options`);
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
                                    No options defined
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
                            0 of {options.length} selected
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
                            <Label className="text-xs">Selection Mode</Label>
                            <div className="flex gap-2">
                                <Button
                                    variant={draftMode === 'single' ? 'secondary' : 'ghost'}
                                    size="sm"
                                    className="flex-1 h-8 text-xs"
                                    onClick={() => setDraftMode('single')}
                                >
                                    Single
                                </Button>
                                <Button
                                    variant={draftMode === 'multi' ? 'secondary' : 'ghost'}
                                    size="sm"
                                    className="flex-1 h-8 text-xs"
                                    onClick={() => setDraftMode('multi')}
                                >
                                    Multiple
                                </Button>
                            </div>
                        </div>

                        {/* Show Search */}
                        <div className="flex items-center justify-between">
                            <Label className="text-xs">Show Search</Label>
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
                            Unsaved
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {hasSettingsChanges && (
                        <Button size="sm" variant="ghost" onClick={handleDiscardSettings} className="h-7 text-xs">
                            Discard
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
                        Save
                    </Button>
                </div>
            </div>

            {/* Option Editor Dialog */}
            <Dialog open={isOptionDialogOpen} onOpenChange={setIsOptionDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {editingOption && options.some(o => o.id === editingOption.id)
                                ? 'Edit Option'
                                : 'Add Option'
                            }
                        </DialogTitle>
                    </DialogHeader>

                    <div className="py-4">
                        <FormRenderer
                            schema={savedContent.optionSchema}
                            values={draftOptionValues}
                            onChange={setDraftOptionValues}
                        />
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsOptionDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveOption}>
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
