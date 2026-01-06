import { useAsset } from '@/hooks/useAsset';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Settings2, Table as TableIcon, Wand2 } from 'lucide-react';
import { DataEditorDialog } from '@/components/data-editor/DataEditorDialog';
import { SchemaEditorDialog } from '@/components/schema-editor/SchemaEditorDialog';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { AutoGenerateButton } from '@/components/ui/auto-generate-button';
import { FieldDefinition } from '@/types/assets';

interface InspectorProps {
    assetId: string;
    nodeId?: string;
}

export function Inspector({ assetId, nodeId }: InspectorProps) {
    const { asset, setValue, updateConfig } = useAsset(assetId);
    const [isTableEditorOpen, setIsTableEditorOpen] = useState(false);
    const [isSchemaEditorOpen, setIsSchemaEditorOpen] = useState(false);

    // Get content
    const { schema, rows, showRowNumbers, allowAddRow, allowDeleteRow } = useMemo(() => {
        const config = (asset?.config as any) || {};
        const extra = config.extra || {};
        const rawValue = asset?.value;

        // Handle value: can be array (rows) or object with rows property
        let rows: Record<string, any>[] = [];
        if (Array.isArray(rawValue)) {
            rows = rawValue;
        } else if (rawValue && typeof rawValue === 'object' && Array.isArray((rawValue as any).rows)) {
            rows = (rawValue as any).rows;
        }

        return {
            schema: (config.schema || []) as FieldDefinition[],
            rows,
            showRowNumbers: extra.showRowNumbers ?? true,
            allowAddRow: extra.allowAddRow ?? true,
            allowDeleteRow: extra.allowDeleteRow ?? true,
        };
    }, [asset?.value, asset?.config]);

    const handleDataSave = (newData: Record<string, any>[]) => {
        setValue(newData);
        toast.success('Table data updated');
    };

    // Handlers
    const handleSchemaChange = (newSchema: FieldDefinition[]) => {
        const currentConfig = asset?.config as any || {};
        updateConfig({
            ...currentConfig,
            schema: newSchema,
        });
        toast.success('Table schema updated');
    };

    const toggleSetting = (key: 'showRowNumbers' | 'allowAddRow' | 'allowDeleteRow') => {
        const currentConfig = asset?.config as any || {};
        const extra = currentConfig.extra || {};
        const currentVal = key === 'showRowNumbers' ? showRowNumbers :
            key === 'allowAddRow' ? allowAddRow : allowDeleteRow;

        updateConfig({
            ...currentConfig,
            extra: {
                ...extra,
                [key]: !currentVal
            }
        });
    };

    if (!asset) return <div className="p-4 text-xs">Asset Not Found</div>;

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* 1. Main Actions */}
                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">
                        Data & Schema
                    </Label>
                    <div className="grid grid-cols-1 gap-2">
                        <Button
                            variant="outline"
                            className="w-full justify-start h-9"
                            onClick={() => setIsTableEditorOpen(true)}
                        >
                            <TableIcon className="h-4 w-4 mr-2 text-blue-500" />
                            Edit Table Data ({rows.length} rows)
                        </Button>
                        <Button
                            variant="outline"
                            className="w-full justify-start h-9"
                            onClick={() => setIsSchemaEditorOpen(true)}
                        >
                            <Settings2 className="h-4 w-4 mr-2 text-purple-500" />
                            Configure Columns ({schema.length})
                        </Button>
                    </div>
                </div>

                <div className="border-t" />

                {/* 2. AI Tools */}
                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase font-semibold tracking-wider flex items-center gap-1.5">
                        <Wand2 className="h-3 w-3" />
                        AI Generation
                    </Label>

                    {schema.length > 0 ? (
                        <AutoGenerateButton
                            mode="table-rows"
                            schema={schema}
                            count={10}
                            onGenerate={(generatedRows) => {
                                setValue([...rows, ...generatedRows]);
                                toast.success(`Added ${generatedRows.length} rows`);
                            }}
                            placeholder="Generate rows based on current columns..."
                            buttonLabel="Generate Rows"
                            buttonVariant="secondary"
                            buttonSize="sm"
                            className="w-full"
                        />
                    ) : (
                        <AutoGenerateButton
                            mode="table-full"
                            count={10}
                            onGenerate={(result) => {
                                const { columns, rows: newRows } = result;
                                // Update Schema
                                const currentConfig = asset?.config as any || {};
                                updateConfig({
                                    ...currentConfig,
                                    schema: columns,
                                });
                                // Update Value
                                setValue(newRows);
                                toast.success('Generated table structure and data');
                            }}
                            placeholder="Describe table (e.g. 'Customer list with name, email, status')..."
                            buttonLabel="Generate Table Structure & Data"
                            buttonVariant="secondary"
                            buttonSize="sm"
                            className="w-full"
                        />
                    )}
                </div>

                <div className="border-t" />

                {/* 3. Settings */}
                <div className="space-y-3">
                    <Label className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">
                        Appearance & Behavior
                    </Label>

                    <div className="flex items-center justify-between">
                        <Label className="text-xs">Show Row Numbers</Label>
                        <Switch
                            checked={showRowNumbers}
                            onCheckedChange={() => toggleSetting('showRowNumbers')}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label className="text-xs">Allow Adding Rows</Label>
                        <Switch
                            checked={allowAddRow}
                            onCheckedChange={() => toggleSetting('allowAddRow')}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label className="text-xs">Allow Deleting Rows</Label>
                        <Switch
                            checked={allowDeleteRow}
                            onCheckedChange={() => toggleSetting('allowDeleteRow')}
                        />
                    </div>
                </div>

            </div>

            {/* Dialogs */}
            <DataEditorDialog
                open={isTableEditorOpen}
                onOpenChange={setIsTableEditorOpen}
                data={rows}
                schema={schema}
                onSave={handleDataSave}
                title="Edit Table Data"
            />

            <SchemaEditorDialog
                open={isSchemaEditorOpen}
                onOpenChange={setIsSchemaEditorOpen}
                schema={schema}
                onChange={handleSchemaChange}
                title="Configure Table Columns"
            />
        </div>
    );
}
