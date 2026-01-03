import { FieldDefinition, FieldType, WidgetType } from '@/types/assets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Trash2, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

interface BuilderProps {
    schema: FieldDefinition[];
    onChange: (schema: FieldDefinition[]) => void;
}

export function SchemaBuilder({ schema, onChange }: BuilderProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newFieldData, setNewFieldData] = useState<Partial<FieldDefinition>>({
        key: '',
        label: '',
        type: 'string',
        widget: 'text',
        connection: 'input'
    });

    const handleAddField = () => {
        if (!newFieldData.key) return;

        const newField: FieldDefinition = {
            key: newFieldData.key,
            label: newFieldData.label || newFieldData.key,
            type: newFieldData.type as FieldType || 'string',
            widget: newFieldData.widget as WidgetType || 'text',
            connection: newFieldData.connection,
            config: newFieldData.config || {}
        };
        onChange([...(schema || []), newField]);

        setIsDialogOpen(false);
        setNewFieldData({ key: '', label: '', type: 'string', widget: 'text', connection: 'input' });
    };

    const updateField = (index: number, updates: Partial<FieldDefinition>) => {
        const newSchema = [...schema];
        newSchema[index] = { ...newSchema[index], ...updates };
        onChange(newSchema);
    };

    const updateConfig = (index: number, updates: Record<string, any>) => {
        const newSchema = [...schema];
        newSchema[index].config = { ...newSchema[index].config || {}, ...updates };
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

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" variant="secondary" className="h-7 text-xs">
                            <Plus className="h-3 w-3 mr-1" /> Add Field
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Add New Field</DialogTitle>
                            <DialogDescription>
                                Define the basic properties of the new input field.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="key" className="text-right text-xs">Key</Label>
                                <Input
                                    id="key"
                                    value={newFieldData.key}
                                    onChange={(e) => setNewFieldData({ ...newFieldData, key: e.target.value })}
                                    className="col-span-3 h-8 text-xs font-mono"
                                    placeholder="e.g. user_prompt"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="label" className="text-right text-xs">Label</Label>
                                <Input
                                    id="label"
                                    value={newFieldData.label}
                                    onChange={(e) => setNewFieldData({ ...newFieldData, label: e.target.value })}
                                    className="col-span-3 h-8 text-xs"
                                    placeholder="Display Name"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="type" className="text-right text-xs">Type</Label>
                                <Select
                                    value={newFieldData.type}
                                    onValueChange={(v) => setNewFieldData({
                                        ...newFieldData,
                                        type: v as FieldType,
                                        widget: v === 'object' ? 'form-input' : v === 'array' ? 'table-input' : undefined
                                    })}
                                >
                                    <SelectTrigger className="col-span-3 h-8 text-xs">
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="string">String</SelectItem>
                                        <SelectItem value="number">Number</SelectItem>
                                        <SelectItem value="boolean">Boolean</SelectItem>
                                        <SelectItem value="object">Object</SelectItem>
                                        <SelectItem value="array">Array</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Widget Selection */}
                            {(newFieldData.type === 'object' || newFieldData.type === 'array') ? (
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right text-xs">Widget</Label>
                                    <div className="col-span-3 text-xs text-muted-foreground flex items-center h-8 bg-muted/30 px-3 rounded border border-transparent">
                                        <span className="text-blue-500 font-medium">
                                            {newFieldData.type === 'object' ? 'Form Input (Connection)' : 'Table Input (Connection)'}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="widget" className="text-right text-xs">Widget</Label>
                                    <Select
                                        value={newFieldData.widget || 'text'}
                                        onValueChange={(v) => setNewFieldData({ ...newFieldData, widget: v as WidgetType })}
                                    >
                                        <SelectTrigger className="col-span-3 h-8 text-xs">
                                            <SelectValue placeholder="Select widget" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {newFieldData.type === 'string' && (
                                                <>
                                                    <SelectItem value="text">Input</SelectItem>
                                                    <SelectItem value="textarea">Text Area</SelectItem>
                                                    <SelectItem value="select">Select Menu</SelectItem>
                                                    <SelectItem value="color">Color Picker</SelectItem>
                                                </>
                                            )}
                                            {newFieldData.type === 'number' && (
                                                <>
                                                    <SelectItem value="number">Number Input</SelectItem>
                                                    <SelectItem value="slider">Slider</SelectItem>
                                                </>
                                            )}
                                            {newFieldData.type === 'boolean' && (
                                                <SelectItem value="switch">Switch</SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Select options */}
                            {newFieldData.widget === 'select' && (
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="options" className="text-right text-xs">Options</Label>
                                    <Input
                                        id="options"
                                        className="col-span-3 h-8 text-xs"
                                        placeholder="A, B, C (comma separated)"
                                        onChange={(e) => {
                                            const opts = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                            setNewFieldData({
                                                ...newFieldData,
                                                config: { ...newFieldData.config, options: opts }
                                            });
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button type="submit" size="sm" onClick={handleAddField} disabled={!newFieldData.key}>Add Field</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="space-y-2 w-full">
                {(schema || []).map((field, index) => (
                    <Collapsible key={field.key || `field-${index}`} className="border rounded-md px-3 bg-card">
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
                                    <Select
                                        value={field.type}
                                        onValueChange={(v: FieldType) => updateField(index, {
                                            type: v,
                                            widget: v === 'object' ? 'form-input' : v === 'array' ? 'table-input' : undefined
                                        })}
                                    >
                                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="string">String</SelectItem>
                                            <SelectItem value="number">Number</SelectItem>
                                            <SelectItem value="boolean">Boolean</SelectItem>
                                            <SelectItem value="object">Object</SelectItem>
                                            <SelectItem value="array">Array</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">Widget</Label>
                                    {(field.type === 'object' || field.type === 'array') ? (
                                        <div className="h-7 text-xs flex items-center px-2 border rounded bg-muted/50 text-blue-500 font-medium">
                                            {field.type === 'object' ? 'Form Input' : 'Table Input'}
                                        </div>
                                    ) : (
                                        <Select value={field.widget || (field.type === 'boolean' ? 'switch' : 'text')} onValueChange={(v: WidgetType) => updateField(index, { widget: v })}>
                                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {field.type === 'string' && (
                                                    <>
                                                        <SelectItem value="text">Input</SelectItem>
                                                        <SelectItem value="textarea">Text Area</SelectItem>
                                                        <SelectItem value="select">Select Menu</SelectItem>
                                                        <SelectItem value="color">Color Picker</SelectItem>
                                                    </>
                                                )}
                                                {field.type === 'number' && (
                                                    <>
                                                        <SelectItem value="number">Number Input</SelectItem>
                                                        <SelectItem value="slider">Slider</SelectItem>
                                                    </>
                                                )}
                                                {field.type === 'boolean' && (
                                                    <SelectItem value="switch">Switch</SelectItem>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>
                            </div>

                            {/* Number Config */}
                            {field.type === 'number' && (
                                <div className="grid grid-cols-3 gap-2 bg-muted/30 p-2 rounded">
                                    <div className="space-y-1">
                                        <Label className="text-[10px]">Min</Label>
                                        <Input type="number" className="h-6 text-xs p-1" value={field.config?.min ?? ''} onChange={e => updateConfig(index, { min: Number(e.target.value) })} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px]">Max</Label>
                                        <Input type="number" className="h-6 text-xs p-1" value={field.config?.max ?? ''} onChange={e => updateConfig(index, { max: Number(e.target.value) })} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px]">Step</Label>
                                        <Input type="number" className="h-6 text-xs p-1" value={field.config?.step ?? ''} onChange={e => updateConfig(index, { step: Number(e.target.value) })} />
                                    </div>
                                </div>
                            )}

                            {/* Select Options */}
                            {field.widget === 'select' && (
                                <div className="space-y-1">
                                    <Label className="text-[10px]">Options (comma separated)</Label>
                                    <Input
                                        className="h-7 text-xs"
                                        placeholder="Option A, Option B"
                                        value={field.config?.options?.join(',') || ''}
                                        onChange={e => updateConfig(index, { options: e.target.value.split(',').map(s => s.trim()) })}
                                    />
                                </div>
                            )}

                            {/* String Config */}
                            {field.type === 'string' && field.widget !== 'select' && (
                                <div className="space-y-2 bg-muted/30 p-2 rounded">
                                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">String Config</Label>
                                    <div className="space-y-1">
                                        <Label className="text-[10px]">Placeholder</Label>
                                        <Input
                                            className="h-6 text-xs p-1"
                                            placeholder="Enter placeholder text..."
                                            value={field.config?.placeholder ?? ''}
                                            onChange={e => updateConfig(index, { placeholder: e.target.value || undefined })}
                                        />
                                    </div>
                                </div>
                            )}
                        </CollapsibleContent>
                    </Collapsible>
                ))}
            </div>
        </div>
    );
}