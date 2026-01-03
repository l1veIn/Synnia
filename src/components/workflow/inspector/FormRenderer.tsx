import { FieldDefinition } from '@/types/assets';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Link } from 'lucide-react';
import { getWidget } from '@/components/workflow/widgets';

interface RendererProps {
    schema: FieldDefinition[];
    values: Record<string, any>;
    onChange: (values: Record<string, any>) => void;
    linkedFields?: Set<string>; // Field keys that are linked (have incoming connections)
}

export function FormRenderer({ schema, values, onChange, linkedFields }: RendererProps) {

    const handleChange = (key: string, val: any) => {
        onChange({
            ...values,
            [key]: val
        });
    };

    if (!schema || schema.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground text-xs">
                No fields defined. <br />Switch to <b>Schema</b> tab to build your form.
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {schema.filter(field => !field.hidden).map((field) => {
                const isLinked = linkedFields?.has(field.key) ?? false;

                return (
                    <div key={field.key} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                {field.label || field.key}
                                {field.required && <span className="text-destructive">*</span>}
                                {isLinked && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded-full">
                                        <Link className="h-2.5 w-2.5" />
                                        Linked
                                    </span>
                                )}
                            </Label>
                        </div>

                        {renderWidget(field, values[field.key], (v) => handleChange(field.key, v), isLinked, isLinked)}
                    </div>
                );
            })}
        </div>
    );
}

function renderWidget(field: FieldDefinition, value: any, onChange: (v: any) => void, disabled?: boolean, isConnected?: boolean) {
    const config = field.config || {};
    const isDisabled = disabled || false;
    const safeVal = value ?? field.defaultValue ?? '';

    // Try to get widget from registry first
    if (field.widget) {
        const widgetDef = getWidget(field.widget);
        if (widgetDef) {
            return widgetDef.render({
                value: safeVal,
                onChange,
                disabled: isDisabled,
                field,
            });
        }
    }

    // Fallback to built-in widgets not in registry
    switch (field.widget) {
        case 'slider':
            const min = config.min ?? 0;
            const max = config.max ?? 100;
            const step = config.step ?? 1;
            const valNum = Number(safeVal) || min;
            return (
                <div className="flex items-center gap-2">
                    <Slider
                        value={[valNum]}
                        min={min} max={max} step={step}
                        onValueChange={(vals) => onChange(vals[0])}
                        className="flex-1"
                        disabled={isDisabled}
                    />
                </div>
            );

        case 'switch':
            return (
                <div className="flex items-center h-8">
                    <Switch checked={!!value} onCheckedChange={onChange} disabled={isDisabled} />
                    <span className="ml-2 text-xs text-muted-foreground">{value ? 'True' : 'False'}</span>
                </div>
            );

        case 'select':
            return (
                <Select value={String(safeVal)} onValueChange={onChange} disabled={isDisabled}>
                    <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                        {(config.options || []).map((opt: string) => (
                            <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            );

        case 'color':
            return (
                <div className="flex items-center gap-2 h-8">
                    <input
                        type="color"
                        className="h-7 w-10 rounded border cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                        value={safeVal || '#000000'}
                        onChange={e => onChange(e.target.value)}
                        disabled={isDisabled}
                    />
                    <Input
                        value={safeVal}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder="#000000"
                        disabled={isDisabled}
                        className="flex-1 h-8 text-xs"
                    />
                </div>
            );
    }

    // Type-based fallback
    if (field.type === 'boolean') {
        return (
            <div className="flex items-center h-8">
                <Switch checked={!!value} onCheckedChange={onChange} disabled={isDisabled} />
                <span className="ml-2 text-xs text-muted-foreground">{value ? 'True' : 'False'}</span>
            </div>
        );
    }

    if (field.type === 'number') {
        return (
            <Input
                type="number"
                value={safeVal}
                onChange={(e) => onChange(Number(e.target.value))}
                disabled={isDisabled}
                min={config.min}
                max={config.max}
                step={config.step}
                className="h-8 text-xs"
            />
        );
    }

    // Default: text input
    return (
        <Input
            value={safeVal}
            onChange={(e) => onChange(e.target.value)}
            disabled={isDisabled}
            placeholder={config.placeholder}
            className="h-8 text-xs"
        />
    );
}