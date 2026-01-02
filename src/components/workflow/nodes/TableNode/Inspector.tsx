import { useAsset } from '@/hooks/useAsset';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, GripVertical, Save, AlertCircle, Edit } from 'lucide-react';
import { TableAssetContent, TableColumn } from './index';
import { TableEditor } from './TableEditor';
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
    const [isEditorOpen, setIsEditorOpen] = useState(false);

    // Get saved content - V2 architecture: rows in value, columns in config
    const savedContent = useMemo(() => {
        const config = (asset?.config as any) || {};
        const rawValue = asset?.value;

        // Handle value: can be array (rows) or object with rows property
        let rows: Record<string, any>[] = [];
        if (Array.isArray(rawValue)) {
            rows = rawValue;
        } else if (rawValue && typeof rawValue === 'object' && Array.isArray((rawValue as any).rows)) {
            rows = (rawValue as any).rows;
        }

        return {
            columns: config.columns ?? [],
            rows,
            showRowNumbers: config.showRowNumbers ?? true,
            allowAddRow: config.allowAddRow ?? true,
            allowDeleteRow: config.allowDeleteRow ?? true,
        };
    }, [asset?.value, asset?.config]);

    // Draft state - for schema only
    const [draftColumns, setDraftColumns] = useState<TableColumn[]>([]);
    const [draftShowRowNumbers, setDraftShowRowNumbers] = useState(true);
    const [isInitialized, setIsInitialized] = useState(false);

    // Initialize
    useEffect(() => {
        if (!isInitialized && asset) {
            setDraftColumns(savedContent.columns);
            setDraftShowRowNumbers(savedContent.showRowNumbers);
            setIsInitialized(true);
        }
    }, [savedContent, isInitialized, asset]);

    // Reset on asset change
    useEffect(() => {
        setDraftColumns(savedContent.columns);
        setDraftShowRowNumbers(savedContent.showRowNumbers);
        setIsInitialized(true);
    }, [assetId]);

    // Check for changes (schema only)
    const hasChanges = useMemo(() => {
        if (!isInitialized) return false;
        return JSON.stringify(draftColumns) !== JSON.stringify(savedContent.columns) ||
            draftShowRowNumbers !== savedContent.showRowNumbers;
    }, [draftColumns, draftShowRowNumbers, savedContent, isInitialized]);

    // Save schema to config
    const handleSave = () => {
        updateConfig({
            columns: draftColumns,
            showRowNumbers: draftShowRowNumbers,
        });
        toast.success('Schema saved');
    };

    // Discard
    const handleDiscard = () => {
        setDraftColumns(savedContent.columns);
        setDraftShowRowNumbers(savedContent.showRowNumbers);
        toast.info('Changes discarded');
    };

    // Column operations
    const addColumn = () => {
        const newCol: TableColumn = {
            key: `col_${draftColumns.length + 1}`,
            label: `Column ${draftColumns.length + 1}`,
            type: 'string',
        };
        setDraftColumns([...draftColumns, newCol]);
    };

    const updateColumn = (idx: number, updates: Partial<TableColumn>) => {
        const newColumns = [...draftColumns];
        newColumns[idx] = { ...newColumns[idx], ...updates };
        setDraftColumns(newColumns);
    };

    const deleteColumn = (idx: number) => {
        setDraftColumns(draftColumns.filter((_, i) => i !== idx));
    };

    if (!asset) return <div className="p-4 text-xs">Asset Not Found</div>;

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Edit Data Button */}
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setIsEditorOpen(true)}
                    >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit ({savedContent.rows.length} rows)
                    </Button>
                    {draftColumns.length > 0 ? (
                        <AutoGenerateButton
                            mode="table-rows"
                            schema={draftColumns.map(c => ({ key: c.key, label: c.label, type: c.type }))}
                            count={30}
                            onGenerate={(rows) => {
                                // Append generated rows to existing rows
                                const newRows = [...savedContent.rows, ...rows];
                                setValue({ ...savedContent, rows: newRows });
                                toast.success(`Added ${rows.length} rows`);
                            }}
                            placeholder="Describe the data to generate..."
                            buttonLabel="+ Rows"
                            buttonVariant="outline"
                            buttonSize="default"
                        />
                    ) : (
                        <AutoGenerateButton
                            mode="table-full"
                            count={30}
                            onGenerate={(result) => {
                                // Set both columns and rows
                                const { columns, rows } = result;
                                setDraftColumns(columns);
                                setValue({
                                    ...savedContent,
                                    columns,
                                    rows,
                                });
                                toast.success(`Created table with ${columns.length} columns and ${rows.length} rows`);
                            }}
                            placeholder="Describe the table structure and data (e.g., 'user profiles with name, email, role')..."
                            buttonLabel="Generate Table"
                            buttonVariant="outline"
                            buttonSize="default"
                        />
                    )}
                </div>

                <div className="border-t" />

                {/* Schema Section */}
                <div className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">
                    Table Schema
                </div>

                {/* Show Row Numbers */}
                <div className="flex items-center justify-between">
                    <Label className="text-xs">Show Row Numbers</Label>
                    <Switch
                        checked={draftShowRowNumbers}
                        onCheckedChange={setDraftShowRowNumbers}
                    />
                </div>

                <div className="border-t" />

                {/* Columns */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs">Columns ({draftColumns.length})</Label>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={addColumn}
                        >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Add
                        </Button>
                    </div>

                    <div className="space-y-2 max-h-[250px] overflow-y-auto">
                        {draftColumns.map((col, idx) => (
                            <div key={idx} className="p-2 border rounded-md bg-muted/30 space-y-2">
                                <div className="flex items-center gap-2">
                                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0 cursor-grab" />
                                    <Input
                                        value={col.label}
                                        onChange={(e) => updateColumn(idx, { label: e.target.value })}
                                        placeholder="Label"
                                        className="h-7 text-xs flex-1"
                                    />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 shrink-0 hover:text-destructive"
                                        onClick={() => deleteColumn(idx)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>

                                <div className="flex gap-2 pl-6">
                                    <div className="flex-1 space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">Key</Label>
                                        <Input
                                            value={col.key}
                                            onChange={(e) => updateColumn(idx, { key: e.target.value })}
                                            className="h-6 text-xs font-mono"
                                        />
                                    </div>
                                    <div className="w-24 space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">Type</Label>
                                        <Select
                                            value={col.type}
                                            onValueChange={(v) => updateColumn(idx, { type: v as any })}
                                        >
                                            <SelectTrigger className="h-6 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="string">String</SelectItem>
                                                <SelectItem value="number">Number</SelectItem>
                                                <SelectItem value="boolean">Boolean</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {draftColumns.length === 0 && (
                            <div className="text-xs text-muted-foreground text-center py-4 border rounded-md border-dashed">
                                No columns defined
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Fixed Footer */}
            <div className="px-4 py-3 border-t bg-muted/10 flex items-center justify-between shrink-0">
                <div className="text-[10px] text-muted-foreground font-mono">
                    {hasChanges && (
                        <span className="text-amber-600 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Unsaved
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {hasChanges && (
                        <Button size="sm" variant="ghost" onClick={handleDiscard} className="h-7 text-xs">
                            Discard
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
                        Save
                    </Button>
                </div>
            </div>

            {/* Editor Dialog */}
            <TableEditor
                open={isEditorOpen}
                onOpenChange={setIsEditorOpen}
                assetId={assetId}
            />
        </div>
    );
}
