import { ViewProps } from './types';
import { FieldDefinition } from '@/types/assets';
import { getWidget } from '@/components/workflow/widgets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit2, Plus, Trash2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TableView({ data, schema, onChange, onNavigate, path }: ViewProps) {
    const rows = Array.isArray(data) ? data : [];

    const handleAddRow = () => {
        const newRow: Record<string, any> = {};
        schema.forEach(field => {
            if (field.defaultValue !== undefined) {
                newRow[field.key] = field.defaultValue;
            }
        });
        onChange([...rows, newRow]);
    };

    const handleDeleteRow = (index: number) => {
        const newRows = [...rows];
        newRows.splice(index, 1);
        onChange(newRows);
    };

    const handleCellChange = (index: number, key: string, value: any) => {
        const newRows = [...rows];
        newRows[index] = { ...newRows[index], [key]: value };
        onChange(newRows);
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-auto bg-background">
                <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-muted/50 sticky top-0 z-10">
                        <tr>
                            <th className="w-10 p-2 border-b text-center text-muted-foreground font-medium">#</th>
                            {schema.map(field => (
                                <th key={field.key} className="p-2 border-b font-medium text-muted-foreground whitespace-nowrap">
                                    {field.label || field.key}
                                </th>
                            ))}
                            <th className="w-16 p-2 border-b"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, index) => (
                            <tr key={index} className="border-b group hover:bg-muted/30">
                                <td className="p-2 text-center text-muted-foreground text-xs border-r bg-muted/10">
                                    {index + 1}
                                </td>
                                {schema.map(field => (
                                    <td key={field.key} className="p-2 border-r last:border-r-0 min-w-[150px]">
                                        <DataCell
                                            field={field}
                                            value={row[field.key]}
                                            onChange={(val) => handleCellChange(index, field.key, val)}
                                            onNavigateCell={() => {
                                                // Use schema-defined type for navigation
                                                const fieldType = field.type === 'array' ? 'array' : 'object';
                                                onNavigate([index, field.key], field.schema || [], fieldType);
                                            }}
                                        />
                                    </td>
                                ))}
                                <td className="p-2 text-center">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => handleDeleteRow(index)}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </td>
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={schema.length + 2} className="p-8 text-center text-muted-foreground">
                                    No rows added yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="p-2 border-t bg-muted/10">
                <Button variant="outline" size="sm" onClick={handleAddRow} className="gap-2">
                    <Plus className="h-3 w-3" /> Add Row
                </Button>
            </div>
        </div>
    );
}

// Internal Cell Component
function DataCell({ field, value, onChange, onNavigateCell }: {
    field: FieldDefinition,
    value: any,
    onChange: (val: any) => void,
    onNavigateCell: () => void
}) {
    // 1. Structural Types -> Drill Down Button
    const isStructural = field.type === 'object' || field.type === 'array' || field.widget === 'form-input' || field.widget === 'table-input';

    if (isStructural) {
        const label = Array.isArray(value)
            ? `${value.length} items`
            : (value && typeof value === 'object') ? 'Object' : 'Empty';

        return (
            <Button
                variant="secondary"
                size="sm"
                className="h-7 text-xs w-full justify-between font-normal"
                onClick={onNavigateCell}
            >
                <span className="truncate">{label}</span>
                <ArrowRight className="h-3 w-3 ml-1 opacity-50" />
            </Button>
        );
    }

    // 2. Widget Rendering (for everything else)
    if (field.widget) {
        const widgetDef = getWidget(field.widget);
        if (widgetDef) {
            return (
                <div className="w-full min-w-0">
                    {widgetDef.render({
                        value,
                        onChange, // Editable in TableView
                        disabled: false,
                        field
                    })}
                </div>
            );
        }
    }

    // 3. Simple Fallbacks
    if (field.type === 'boolean') {
        return <Switch checked={!!value} onCheckedChange={onChange} />;
    }

    return (
        <Input
            className="h-7 text-xs px-2 shadow-none border-transparent hover:border-input focus:border-input bg-transparent"
            value={value ?? ''}
            onChange={(e) => onChange(field.type === 'number' ? Number(e.target.value) : e.target.value)}
            placeholder="..."
        />
    );
}
