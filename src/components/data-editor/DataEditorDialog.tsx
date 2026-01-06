import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DataEditor } from './DataEditor';
import { FieldDefinition } from '@/types/assets';

interface DataEditorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    data: any;
    schema: FieldDefinition[];
    onSave: (data: any) => void;
    title?: string;
}

export function DataEditorDialog({
    open,
    onOpenChange,
    data,
    schema,
    onSave,
    title = "Edit Data"
}: DataEditorDialogProps) {
    const [draftData, setDraftData] = useState<any>(null);
    const [hasChanges, setHasChanges] = useState(false);

    // Reset draft when opening
    useEffect(() => {
        if (open) {
            // Deep clone to avoid mutating original ref
            setDraftData(JSON.parse(JSON.stringify(data || [])));
            setHasChanges(false);
        }
    }, [open, data]);

    const handleSave = () => {
        onSave(draftData);
        onOpenChange(false);
    };

    const handleChange = (newData: any) => {
        setDraftData(newData);
        setHasChanges(true);
    };

    if (!draftData) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0 overflow-hidden outline-none bg-background shadow-lg sm:rounded-lg" aria-describedby={undefined}>
                <DialogHeader className="px-4 py-3 border-b h-12 flex flex-row items-center justify-between shrink-0 bg-background pr-10">
                    <DialogTitle className="text-sm font-semibold flex items-center gap-2">
                        {title}
                        {hasChanges && (
                            <span className="text-[10px] bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded">
                                Unsaved
                            </span>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 min-h-0 overflow-hidden">
                    <DataEditor
                        data={draftData}
                        schema={schema}
                        onChange={handleChange}
                        className="h-full"
                    />
                </div>

                {/* Footer with action buttons */}
                <div className="px-4 py-3 border-t bg-background shrink-0 flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8">
                        Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave} className="h-8">
                        Save Changes
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
