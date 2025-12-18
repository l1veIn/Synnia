import { FieldDefinition } from '@/types/assets';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'lucide-react';
import { AspectRatioSelector } from './widgets/AspectRatioSelector';
import { ModelConfigurator } from './widgets/ModelConfigurator';
import { ImagePicker } from './widgets/ImagePicker';
import { LLMConfigurator } from './widgets/LLMConfigurator';
import { JSONInput } from './widgets/JSONInput';
import { TextInput } from './widgets/TextInput';
import { TextArea } from './widgets/TextArea';

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
                const isDisabled = field.disabled || isLinked;

                return (
                    <div key={field.id} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                {field.label || field.key}
                                {field.rules?.required && <span className="text-destructive">*</span>}
                                {isLinked && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded-full">
                                        <Link className="h-2.5 w-2.5" />
                                        Linked
                                    </span>
                                )}
                                {field.disabled && !isLinked && (
                                    <span className="text-muted-foreground/50 text-[10px]">(read-only)</span>
                                )}
                            </Label>
                        </div>

                        {renderWidget(field, values[field.key], (v) => handleChange(field.key, v), isDisabled, isLinked)}
                    </div>
                );
            })}
        </div>
    );
}

function renderWidget(field: FieldDefinition, value: any, onChange: (v: any) => void, disabled?: boolean, isConnected?: boolean) {
    const rules = field.rules || {};
    const isDisabled = disabled || false;
    const safeVal = value ?? field.defaultValue ?? '';

    // Widget-first approach: check widget type first
    switch (field.widget) {
        // === Custom Widgets ===
        case 'json-input':
            return (
                <JSONInput
                    value={value}
                    requiredKeys={rules.requiredKeys}
                    isConnected={isConnected}
                    connectedLabel="Connected"
                />
            );

        case 'model-configurator':
            return (
                <ModelConfigurator
                    value={safeVal}
                    onChange={onChange}
                    disabled={isDisabled}
                    filterCategory={rules.filterRecipeType}
                />
            );

        case 'aspect-ratio-selector':
            return (
                <AspectRatioSelector
                    value={safeVal}
                    onChange={onChange}
                    disabled={isDisabled}
                />
            );

        case 'image-picker':
            return (
                <ImagePicker
                    value={safeVal}
                    onChange={onChange}
                    disabled={isDisabled}
                    isConnected={isConnected}
                    connectedLabel="Connected to image node"
                />
            );

        case 'llm-configurator':
            return (
                <LLMConfigurator
                    value={safeVal}
                    onChange={onChange}
                    disabled={isDisabled}
                    filterCapability={rules.filterCapability as any}
                />
            );

        // === Standard Widgets ===
        case 'textarea':
            return (
                <TextArea
                    value={safeVal}
                    onChange={onChange}
                    disabled={isDisabled}
                    placeholder={rules.placeholder}
                    isConnected={isConnected}
                    showEnhance={true}
                />
            );

        case 'text':
            return (
                <TextInput
                    value={safeVal}
                    onChange={onChange}
                    disabled={isDisabled}
                    placeholder={rules.placeholder}
                    isConnected={isConnected}
                />
            );

        case 'number':
            return (
                <TextInput
                    type="number"
                    value={safeVal}
                    onChange={onChange}
                    disabled={isDisabled}
                    min={rules.min}
                    max={rules.max}
                    step={rules.step}
                    isConnected={isConnected}
                />
            );

        case 'slider':
            const min = rules.min ?? 0;
            const max = rules.max ?? 100;
            const step = rules.step ?? 1;
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
                        {(rules.options || []).map(opt => (
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
                    <TextInput
                        value={safeVal}
                        onChange={onChange}
                        placeholder="#000000"
                        disabled={isDisabled}
                        className="flex-1"
                    />
                </div>
            );

        // === Fallback: infer from field.type ===
        default:
            // Type-based inference as fallback
            if (field.type === 'boolean') {
                return (
                    <div className="flex items-center h-8">
                        <Switch checked={!!value} onCheckedChange={onChange} disabled={isDisabled} />
                        <span className="ml-2 text-xs text-muted-foreground">{value ? 'True' : 'False'}</span>
                    </div>
                );
            }

            if (field.type === 'select') {
                return (
                    <Select value={String(safeVal)} onValueChange={onChange} disabled={isDisabled}>
                        <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                            {(rules.options || []).map(opt => (
                                <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );
            }

            if (field.type === 'number') {
                return (
                    <TextInput
                        type="number"
                        value={safeVal}
                        onChange={onChange}
                        disabled={isDisabled}
                        min={rules.min}
                        max={rules.max}
                        step={rules.step}
                        isConnected={isConnected}
                    />
                );
            }

            // Default: text input
            return (
                <TextInput
                    value={safeVal}
                    onChange={onChange}
                    disabled={isDisabled}
                    placeholder={rules.placeholder}
                    isConnected={isConnected}
                />
            );
    }
}