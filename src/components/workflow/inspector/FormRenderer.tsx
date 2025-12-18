import { FieldDefinition } from '@/types/assets';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'lucide-react';
import { AspectRatioSelector } from './widgets/AspectRatioSelector';
import { PromptEnhancer } from './widgets/PromptEnhancer';
import { ModelConfigurator } from './widgets/ModelConfigurator';
import { ImagePicker } from './widgets/ImagePicker';
import { LLMConfigurator } from './widgets/LLMConfigurator';

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

    // 1. Special Widget: Node Input (Read-only, Graph Driven)
    if (field.widget === 'node-input') {
        return (
            <div className="h-8 w-full rounded border bg-muted/30 flex items-center px-3 text-xs text-muted-foreground select-none cursor-not-allowed">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse" />
                <span className="font-medium mr-1">Node Input</span>
                <span className="opacity-50 italic">- Connect on Canvas</span>
            </div>
        );
    }

    // Default fallback values
    const safeVal = value ?? field.defaultValue ?? '';

    switch (field.type) {
        case 'boolean':
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
        case 'number':
            if (field.widget === 'slider') {
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
                        <Input
                            type="number"
                            className="w-12 h-7 text-xs text-right p-1"
                            value={safeVal}
                            onChange={e => onChange(Number(e.target.value))}
                            disabled={isDisabled}
                        />
                    </div>
                );
            }
            return (
                <Input
                    type="number"
                    className="h-8 text-xs"
                    value={safeVal}
                    min={rules.min} max={rules.max} step={rules.step}
                    onChange={(e) => onChange(Number(e.target.value))}
                    disabled={isDisabled}
                />
            );
        case 'string':
        default:
            if (field.widget === 'model-configurator') {
                return (
                    <ModelConfigurator
                        value={safeVal}
                        onChange={onChange}
                        disabled={isDisabled}
                        filterCategory={rules.filterRecipeType}
                    />
                );
            }
            if (field.widget === 'aspect-ratio-selector') {
                return (
                    <AspectRatioSelector
                        value={safeVal}
                        onChange={onChange}
                        disabled={isDisabled}
                    />
                );
            }
            if (field.widget === 'image-picker') {
                return (
                    <ImagePicker
                        value={safeVal}
                        onChange={onChange}
                        disabled={isDisabled}
                        isConnected={isConnected}
                        connectedLabel="Connected to image node"
                    />
                );
            }
            if (field.widget === 'llm-configurator') {
                return (
                    <LLMConfigurator
                        value={safeVal}
                        onChange={onChange}
                        disabled={isDisabled}
                        filterCapability={rules.filterCapability as any}
                    />
                );
            }
            if (field.widget === 'prompt-enhancer') {
                return (
                    <PromptEnhancer
                        value={safeVal}
                        onChange={onChange}
                        disabled={isDisabled}
                        placeholder={rules.placeholder}
                    />
                );
            }
            if (field.widget === 'textarea') {
                return (
                    <Textarea
                        className="text-xs min-h-[80px]"
                        value={safeVal}
                        onChange={e => onChange(e.target.value)}
                        placeholder={rules.placeholder}
                        disabled={isDisabled}
                    />
                );
            }
            if (field.widget === 'color') {
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
                            className="h-8 text-xs font-mono flex-1"
                            value={safeVal}
                            onChange={e => onChange(e.target.value)}
                            placeholder="#000000"
                            disabled={isDisabled}
                        />
                    </div>
                );
            }
            return (
                <Input
                    className="h-8 text-xs"
                    value={safeVal}
                    onChange={e => onChange(e.target.value)}
                    placeholder={rules.placeholder}
                    disabled={isDisabled}
                />
            );
    }
}