import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Save } from 'lucide-react';
import { useAsset } from '@/hooks/useAsset';
import { TableAssetContent } from './index';
import { toast } from 'sonner';

interface TableEditorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    assetId?: string;
}

export function TableEditor({ open, onOpenChange, assetId }: TableEditorProps) {
    const { asset, setValue } = useAsset(assetId);

    // Get saved content - now from asset.value
    const savedContent: TableAssetContent = useMemo(() => {
        const raw = (asset?.value as TableAssetContent) || {};
        return {
            columns: raw.columns ?? [],
            rows: raw.rows ?? [],
            showRowNumbers: raw.showRowNumbers ?? true,
            allowAddRow: raw.allowAddRow ?? true,
            allowDeleteRow: raw.allowDeleteRow ?? true,
        };
    }, [asset?.value]);

    // Draft state
    const [draftRows, setDraftRows] = useState<Record<string, any>[]>([]);
    const [isInitialized, setIsInitialized] = useState(false);

    // Initialize draft when dialog opens
    useEffect(() => {
        if (open && asset) {
            setDraftRows(JSON.parse(JSON.stringify(savedContent.rows)));
            setIsInitialized(true);
        }
    }, [open, asset, savedContent.rows]);

    // Check for changes
    const hasChanges = useMemo(() => {
        if (!isInitialized) return false;
        return JSON.stringify(draftRows) !== JSON.stringify(savedContent.rows);
    }, [draftRows, savedContent.rows, isInitialized]);

    // Update cell
    const updateCell = (rowIdx: number, colKey: string, value: any) => {
        const newRows = [...draftRows];
        newRows[rowIdx] = { ...newRows[rowIdx], [colKey]: value };
        setDraftRows(newRows);
    };

    // Add row
    const addRow = () => {
        const newRow: Record<string, any> = {};
        savedContent.columns.forEach(col => {
            newRow[col.key] = col.type === 'number' ? 0 : col.type === 'boolean' ? false : '';
        });
        setDraftRows([...draftRows, newRow]);
    };

    // Delete row
    const deleteRow = (rowIdx: number) => {
        setDraftRows(draftRows.filter((_, idx) => idx !== rowIdx));
    };

    // Save
    const handleSave = () => {
        setValue({ ...savedContent, rows: draftRows });
        toast.success('Table saved');
        onOpenChange(false);
    };

    // Cancel
    const handleCancel = () => {
        if (hasChanges) {
            // Reset to saved
            setDraftRows(JSON.parse(JSON.stringify(savedContent.rows)));
        }
        onOpenChange(false);
    };

    if (!asset) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        Edit Table Data
                        {hasChanges && (
                            <span className="text-xs bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded">
                                Unsaved
                            </span>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 min-h-0 overflow-auto border rounded-md">
                    {savedContent.columns.length === 0 ? (
                        <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                            No columns defined. Configure columns in the Inspector panel.
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-muted z-10">
                                <tr className="border-b">
                                    <th className="px-3 py-2 text-left text-muted-foreground w-10">#</th>
                                    {savedContent.columns.map(col => (
                                        <th key={col.key} className="px-3 py-2 text-left font-medium">
                                            {col.label || col.key}
                                            <span className="ml-1 text-[10px] text-muted-foreground font-normal">
                                                ({col.type})
                                            </span>
                                        </th>
                                    ))}
                                    <th className="w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {draftRows.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={savedContent.columns.length + 2}
                                            className="text-center py-8 text-muted-foreground"
                                        >
                                            No rows. Click "Add Row" to start.
                                        </td>
                                    </tr>
                                ) : (
                                    draftRows.map((row, rowIdx) => (
                                        <tr key={rowIdx} className="border-b hover:bg-muted/30">
                                            <td className="px-3 py-1 text-muted-foreground text-center">
                                                {rowIdx + 1}
                                            </td>
                                            {savedContent.columns.map(col => (
                                                <td key={col.key} className="px-2 py-1">
                                                    <Input
                                                        type={col.type === 'number' ? 'number' : 'text'}
                                                        value={row[col.key] ?? ''}
                                                        onChange={(e) => updateCell(
                                                            rowIdx,
                                                            col.key,
                                                            col.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value
                                                        )}
                                                        className="h-8 text-sm"
                                                    />
                                                </td>
                                            ))}
                                            <td className="px-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 hover:text-destructive"
                                                    onClick={() => deleteRow(rowIdx)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Action Bar */}
                {savedContent.columns.length > 0 && (
                    <div className="flex items-center justify-between pt-2 border-t mt-2">
                        <Button variant="outline" size="sm" onClick={addRow}>
                            <Plus className="h-4 w-4 mr-1" />
                            Add Row
                        </Button>
                        <span className="text-xs text-muted-foreground">
                            {draftRows.length} rows
                        </span>
                    </div>
                )}

                <DialogFooter className="mt-4">
                    <Button variant="ghost" onClick={handleCancel}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={!hasChanges}>
                        <Save className="h-4 w-4 mr-1" />
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
