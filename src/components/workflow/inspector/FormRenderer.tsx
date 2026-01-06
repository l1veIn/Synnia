import { FieldDefinition } from '@/types/assets';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Link } from 'lucide-react';
import { getWidget } from '@/components/workflow/widgets';

interface LinkedFieldInfo {
    sourceTitle: string;
    value: any;
}

interface RendererProps {
    schema: FieldDefinition[];
    values: Record<string, any>;
    onChange: (values: Record<string, any>) => void;
    linkedFields?: Set<string>;
    linkedFieldsInfo?: Record<string, LinkedFieldInfo>;
}

export function FormRenderer({ schema, values, onChange, linkedFields, linkedFieldsInfo }: RendererProps) {

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
                const linkInfo = linkedFieldsInfo?.[field.key];
                // For linked fields, use the connected value for display
                const displayValue = isLinked && linkInfo ? linkInfo.value : values[field.key];

                return (
                    <div key={field.key} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                {field.label || field.key}
                                {field.required && <span className="text-destructive">*</span>}
                                {isLinked && linkInfo && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded-full">
                                        <Link className="h-2.5 w-2.5" />
                                        ← {linkInfo.sourceTitle}
                                    </span>
                                )}
                            </Label>
                        </div>

                        {renderWidget(field, displayValue, (v) => handleChange(field.key, v), isLinked)}
                    </div>
                );
            })}
        </div>
    );
}

function renderWidget(field: FieldDefinition, value: any, onChange: (v: any) => void, disabled?: boolean) {
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

    // Type-based fallback (when no widget specified)
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