import { Button } from '@/components/ui/button';
import { Plus, GripVertical, Edit, Trash2 } from 'lucide-react';
import { AutoGenerateButton } from '@/components/ui/auto-generate-button';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import type { OptionsTabProps } from './types';

export function OptionsTab({ ctx }: OptionsTabProps) {
    const { t } = useTranslation('inspector');
    const { options, draftSchema, setValue, updateConfig, setDraftSchema, onAddOption, onEditOption, onDeleteOption, getOptionLabel } = ctx;

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* Add buttons */}
            <div className="flex gap-2">
                <Button
                    variant="outline"
                    className="flex-1"
                    onClick={onAddOption}
                >
                    <Plus className="h-4 w-4 mr-2" />
                    {t('selector.addOption')}
                </Button>
                <AutoGenerateButton
                    mode="table-full"
                    count={30}
                    onGenerate={(result) => {
                        const { columns, rows } = result;
                        const newSchema = columns.map((c: any) => ({
                            id: c.key,
                            key: c.key,
                            label: c.label,
                            type: c.type || 'string',
                        }));
                        const newOptions = rows.map((r: any) => ({
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
                    options.map((option) => (
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
                                onClick={() => onEditOption(option.id)}
                            >
                                <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 hover:text-destructive"
                                onClick={() => onDeleteOption(option.id)}
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
    );
}
