import React from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// import { Textarea } from "@/components/ui/textarea";
import { cn } from '@/lib/utils';

export interface SchemaField {
    type: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';
    title?: string;
    description?: string;
    enum?: string[];
    default?: any;
    properties?: Record<string, SchemaField>;
    required?: string[];
}

interface SchemaFormProps {
    schema: SchemaField;
    data: any;
    onChange: (data: any) => void;
    path?: string; // For debugging or nested keys
    depth?: number;
}

export const SchemaForm: React.FC<SchemaFormProps> = ({ schema, data, onChange, path = '', depth = 0 }) => {
    
    // 1. Handle Object (Recursive)
    if (schema.type === 'object' && schema.properties) {
        return (
            <div className={cn("space-y-4", depth > 0 && "pl-4 border-l border-border/50")}>
                {schema.title && depth > 0 && <h4 className="text-sm font-semibold text-foreground/80 mb-2">{schema.title}</h4>}
                {Object.entries(schema.properties).map(([key, fieldSchema]) => {
                    const isRequired = schema.required?.includes(key);
                    return (
                        <div key={key} className="space-y-2">
                            {fieldSchema.type !== 'object' && fieldSchema.type !== 'boolean' && (
                                <Label className={cn("text-xs font-medium text-muted-foreground", isRequired && "after:content-['*'] after:ml-0.5 after:text-red-500")}>
                                    {fieldSchema.title || key}
                                </Label>
                            )}
                            
                            <SchemaForm
                                schema={fieldSchema}
                                data={data?.[key]}
                                onChange={(val) => onChange({ ...data, [key]: val })}
                                path={`${path}.${key}`}
                                depth={depth + 1}
                            />
                            
                            {fieldSchema.description && (
                                <p className="text-[10px] text-muted-foreground/70">{fieldSchema.description}</p>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    }

    // 2. Handle Boolean (Switch)
    if (schema.type === 'boolean') {
        return (
            <div className="flex items-center justify-between space-x-2 py-1">
                <Label className="flex flex-col space-y-1">
                    <span>{schema.title}</span>
                    {schema.description && <span className="font-normal text-[10px] text-muted-foreground">{schema.description}</span>}
                </Label>
                <Switch 
                    checked={data === true} 
                    onCheckedChange={onChange} 
                />
            </div>
        );
    }

    // 3. Handle Enum (Select)
    if (schema.enum) {
        return (
            <Select value={data || ''} onValueChange={onChange}>
                <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                    {schema.enum.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        );
    }

    // 4. Handle Long Text (Textarea)
    // Simple heuristic: if no title but key has 'description' or 'prompt' or 'content', use textarea
    // Or strictly check a custom format. For now, let's assume if description says "Long", use textarea? 
    // No, let's just default to Input for now, unless it looks like a prompt.
    
    // 5. Handle String/Number (Input)
    return (
        <Input
            type={schema.type === 'number' || schema.type === 'integer' ? 'number' : 'text'}
            value={data || ''}
            onChange={(e) => {
                const val = e.target.value;
                if (schema.type === 'number' || schema.type === 'integer') {
                    onChange(Number(val));
                } else {
                    onChange(val);
                }
            }}
            placeholder={schema.default ? `Default: ${schema.default}` : ''}
            className="bg-background/50"
        />
    );
};
