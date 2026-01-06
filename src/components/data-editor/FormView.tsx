import { ViewProps } from './types';
import { FieldDefinition } from '@/types/assets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, ChevronRight, Link as LinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getWidget } from '@/components/workflow/widgets';

export function FormView({ data, schema, onChange, onNavigate }: ViewProps) {
    const values = data || {};

    const handleChange = (key: string, val: any) => {
        onChange({ ...values, [key]: val });
    };

    return (
        <div className="space-y-6 p-4 max-w-2xl mx-auto">
            {schema.map(field => {
                const value = values[field.key];
                const isComplex = field.type === 'object' || field.type === 'array' || field.widget === 'form-input' || field.widget === 'table-input';

                return (
                    <div key={field.key} className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                            {field.label || field.key}
                            {field.required && <span className="text-destructive">*</span>}
                        </Label>

                        {isComplex ? (
                            <Button
                                variant="outline"
                                className="w-full justify-between font-normal h-9 bg-background"
                                onClick={() => {
                                    // Navigate using schema-defined type
                                    const nestedSchema = field.schema || [];
                                    const fieldType = field.type === 'array' ? 'array' : 'object';
                                    onNavigate(field.key, nestedSchema, fieldType);
                                }}
                            >
                                <span className="text-muted-foreground text-xs">
                                    {Array.isArray(value)
                                        ? `${value.length} items`
                                        : (value && typeof value === 'object') ? 'Object' : 'Empty'}
                                </span>
                                <ChevronRight className="h-4 w-4 opacity-50" />
                            </Button>
                        ) : (
                            // Widget Rendering
                            <div className="w-full">
                                {field.widget && getWidget(field.widget) ? (
                                    <div className="[&>div]:w-full">
                                        {getWidget(field.widget)!.render({
                                            value,
                                            onChange: (v) => handleChange(field.key, v),
                                            disabled: false,
                                            field
                                        })}
                                    </div>
                                ) : field.type === 'boolean' ? (
                                    <div className="flex items-center h-9">
                                        <Switch checked={!!value} onCheckedChange={(c) => handleChange(field.key, c)} />
                                        <span className="ml-2 text-xs text-muted-foreground">{value ? 'True' : 'False'}</span>
                                    </div>
                                ) : (
                                    <Input
                                        className="h-9 text-xs"
                                        value={value ?? ''}
                                        onChange={(e) => handleChange(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)}
                                        placeholder="..."
                                    />
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// SimpleWidget removed

