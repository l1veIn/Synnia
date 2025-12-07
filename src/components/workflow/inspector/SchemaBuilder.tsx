import { FieldDefinition, FieldType, WidgetType } from '@/types/assets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Trash2, ChevronDown } from 'lucide-react';

interface BuilderProps {
    schema: FieldDefinition[];
    onChange: (schema: FieldDefinition[]) => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

export function SchemaBuilder({ schema, onChange }: BuilderProps) {
    const addField = () => {
        const newField: FieldDefinition = {
            id: generateId(),
            key: `field_${(schema?.length || 0) + 1}`,
            label: 'New Field',
            type: 'string',
            widget: 'text',
            rules: {}
        };
        onChange([...(schema || []), newField]);
    };

    const updateField = (index: number, updates: Partial<FieldDefinition>) => {
        const newSchema = [...schema];
        newSchema[index] = { ...newSchema[index], ...updates };
        onChange(newSchema);
    };
    
    const updateRules = (index: number, updates: any) => {
        const newSchema = [...schema];
        newSchema[index].rules = { ...newSchema[index].rules || {}, ...updates };
        onChange(newSchema);
    };

    const removeField = (index: number) => {
        const newSchema = schema.filter((_, i) => i !== index);
        onChange(newSchema);
    };

    return (
        <div className="space-y-4">
             <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Fields Config</Label>
                <Button size="sm" variant="secondary" onClick={addField} className="h-7 text-xs">
                    <Plus className="h-3 w-3 mr-1" /> Add Field
                </Button>
            </div>
            
            <div className="space-y-2 w-full">
                {(schema || []).map((field, index) => (
                    <Collapsible key={field.id} className="border rounded-md px-3 bg-card">
                        <div className="flex items-center py-2">
                             <CollapsibleTrigger className="flex-1 text-left flex items-center text-xs font-medium group hover:opacity-80">
                                 <span className="text-muted-foreground mr-2 font-mono">{field.key}</span>
                                 <span className="truncate max-w-[120px]">{field.label}</span>
                                 <ChevronDown className="h-3 w-3 ml-2 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                             </CollapsibleTrigger>
                             <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive ml-2 shrink-0" onClick={() => removeField(index)}>
                                <Trash2 className="h-3 w-3" />
                             </Button>
                        </div>
                        
                        <CollapsibleContent className="pt-2 pb-4 space-y-4 border-t mt-2">
                             {/* Key & Label */}
                             <div className="grid grid-cols-2 gap-2">
                                 <div className="space-y-1">
                                     <Label className="text-[10px] text-muted-foreground">Variable Key</Label>
                                     <Input 
                                        className="h-7 text-xs font-mono" 
                                        value={field.key} 
                                        onChange={e => updateField(index, { key: e.target.value })} 
                                    />
                                 </div>
                                 <div className="space-y-1">
                                     <Label className="text-[10px] text-muted-foreground">Display Label</Label>
                                     <Input 
                                        className="h-7 text-xs" 
                                        value={field.label} 
                                        onChange={e => updateField(index, { label: e.target.value })} 
                                    />
                                 </div>
                             </div>
                             
                             {/* Type & Widget */}
                             <div className="grid grid-cols-2 gap-2">
                                 <div className="space-y-1">
                                     <Label className="text-[10px] text-muted-foreground">Type</Label>
                                     <Select value={field.type} onValueChange={(v: FieldType) => updateField(index, { type: v })}>
                                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="string">String</SelectItem>
                                            <SelectItem value="number">Number</SelectItem>
                                            <SelectItem value="boolean">Boolean</SelectItem>
                                            <SelectItem value="select">Select</SelectItem>
                                        </SelectContent>
                                     </Select>
                                 </div>
                                 <div className="space-y-1">
                                     <Label className="text-[10px] text-muted-foreground">Widget</Label>
                                     <Select value={field.widget || 'text'} onValueChange={(v: WidgetType) => updateField(index, { widget: v })}>
                                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="text">Input</SelectItem>
                                            <SelectItem value="textarea">Text Area</SelectItem>
                                            <SelectItem value="number">Number Input</SelectItem>
                                            <SelectItem value="slider">Slider</SelectItem>
                                            <SelectItem value="switch">Switch</SelectItem>
                                            <SelectItem value="select">Select Menu</SelectItem>
                                        </SelectContent>
                                     </Select>
                                 </div>
                             </div>
                             
                             {/* Type Specific Config */}
                             {field.type === 'number' && (
                                 <div className="grid grid-cols-3 gap-2 bg-muted/30 p-2 rounded">
                                     <div className="space-y-1">
                                         <Label className="text-[10px]">Min</Label>
                                         <Input type="number" className="h-6 text-xs p-1" value={field.rules?.min ?? ''} onChange={e => updateRules(index, { min: Number(e.target.value) })} />
                                     </div>
                                     <div className="space-y-1">
                                         <Label className="text-[10px]">Max</Label>
                                         <Input type="number" className="h-6 text-xs p-1" value={field.rules?.max ?? ''} onChange={e => updateRules(index, { max: Number(e.target.value) })} />
                                     </div>
                                     <div className="space-y-1">
                                         <Label className="text-[10px]">Step</Label>
                                         <Input type="number" className="h-6 text-xs p-1" value={field.rules?.step ?? ''} onChange={e => updateRules(index, { step: Number(e.target.value) })} />
                                     </div>
                                 </div>
                             )}

                             {field.type === 'select' && (
                                 <div className="space-y-1">
                                     <Label className="text-[10px]">Options (comma separated)</Label>
                                     <Input 
                                        className="h-7 text-xs" 
                                        placeholder="Option A, Option B"
                                        value={field.rules?.options?.join(',') || ''}
                                        onChange={e => updateRules(index, { options: e.target.value.split(',').map(s => s.trim()) })}
                                     />
                                 </div>
                             )}
                        </CollapsibleContent>
                    </Collapsible>
                ))}
            </div>
        </div>
    );
}