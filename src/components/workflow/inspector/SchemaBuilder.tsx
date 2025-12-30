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

const generateId = () => Math.random().toString(36).substr(2, 9);

export function SchemaBuilder({ schema, onChange }: BuilderProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newFieldData, setNewFieldData] = useState<Partial<FieldDefinition>>({
        key: '',
        label: '',
        type: 'string',
        widget: 'text',
        connection: { enabled: true }
    });

    const handleAddField = () => {
        if (!newFieldData.key) return; // Key is required

        const newField: FieldDefinition = {
            id: generateId(),
            key: newFieldData.key,
            label: newFieldData.label || newFieldData.key,
            type: newFieldData.type as FieldType || 'string',
            widget: newFieldData.widget as WidgetType || 'text',
            connection: newFieldData.connection,
            rules: newFieldData.rules || {}
        };
        onChange([...(schema || []), newField]);

        // Reset and close
        setIsDialogOpen(false);
        setNewFieldData({ key: '', label: '', type: 'string', widget: 'text', connection: { enabled: true } });
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
                                        widget: v === 'object' ? 'json-input' : undefined
                                    })}
                                >
                                    <SelectTrigger className="col-span-3 h-8 text-xs">
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="string">String</SelectItem>
                                        <SelectItem value="number">Number</SelectItem>
                                        <SelectItem value="boolean">Boolean</SelectItem>
                                        <SelectItem value="select">Select</SelectItem>
                                        <SelectItem value="object">JSON Object</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Widget Selection */}
                            {newFieldData.type === 'object' ? (
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right text-xs">Widget</Label>
                                    <div className="col-span-3 text-xs text-muted-foreground flex items-center h-8 bg-muted/30 px-3 rounded border border-transparent">
                                        <span className="text-blue-500 font-medium">Node Connection (Input)</span>
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
                                                    <SelectItem value="json-input" className="text-blue-500 font-medium">JSON Connection</SelectItem>
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
                                            {newFieldData.type === 'select' && (
                                                <SelectItem value="select">Select Menu</SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Type Specific Config */}
                            {newFieldData.widget === 'json-input' && (
                                <div className="grid grid-cols-4 items-start gap-4">
                                    <Label className="text-right text-xs pt-2">Expected Keys</Label>
                                    <div className="col-span-3 space-y-2">
                                        <div className="flex flex-wrap gap-1">
                                            {(newFieldData.rules?.requiredKeys || []).map((key: string, idx: number) => (
                                                <span
                                                    key={idx}
                                                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/10 text-blue-600 rounded text-xs font-mono"
                                                >
                                                    {key}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const keys = [...(newFieldData.rules?.requiredKeys || [])];
                                                            keys.splice(idx, 1);
                                                            setNewFieldData({
                                                                ...newFieldData,
                                                                rules: { ...newFieldData.rules, requiredKeys: keys }
                                                            });
                                                        }}
                                                        className="hover:text-red-500 transition-colors"
                                                    >
                                                        ×
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                        <Input
                                            className="h-8 text-xs font-mono"
                                            placeholder="Type key and press Enter"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                                    e.preventDefault();
                                                    const newKey = e.currentTarget.value.trim();
                                                    const keys = [...(newFieldData.rules?.requiredKeys || []), newKey];
                                                    setNewFieldData({
                                                        ...newFieldData,
                                                        rules: { ...newFieldData.rules, requiredKeys: keys }
                                                    });
                                                    e.currentTarget.value = '';
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

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
                                                rules: { ...newFieldData.rules, options: opts }
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
                    <Collapsible key={field.id || field.key || `field-${index}`} className="border rounded-md px-3 bg-card">
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
                                    <Select value={field.type} onValueChange={(v: FieldType) => updateField(index, { type: v, widget: v === 'object' ? 'json-input' : undefined })}>
                                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="string">String</SelectItem>
                                            <SelectItem value="number">Number</SelectItem>
                                            <SelectItem value="boolean">Boolean</SelectItem>
                                            <SelectItem value="select">Select</SelectItem>
                                            <SelectItem value="object">JSON Object</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">Widget</Label>
                                    {field.type === 'object' ? (
                                        <div className="h-7 text-xs flex items-center px-2 border rounded bg-muted/50 text-blue-500 font-medium">Node Connection</div>
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
                                                        <SelectItem value="json-input" className="text-blue-500 font-medium">JSON Connection</SelectItem>
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
                                                {field.type === 'select' && (
                                                    <SelectItem value="select">Select Menu</SelectItem>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>
                            </div>

                            {/* Type Specific Config */}
                            {field.widget === 'json-input' && (
                                <div className="space-y-2">
                                    <Label className="text-[10px] text-muted-foreground">Expected Keys</Label>
                                    <div className="flex flex-wrap gap-1 min-h-[24px]">
                                        {(field.rules?.requiredKeys || []).map((key: string, idx: number) => (
                                            <span
                                                key={idx}
                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/10 text-blue-600 rounded text-[10px] font-mono"
                                            >
                                                {key}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const keys = [...(field.rules?.requiredKeys || [])];
                                                        keys.splice(idx, 1);
                                                        updateRules(index, { requiredKeys: keys });
                                                    }}
                                                    className="hover:text-red-500 transition-colors"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                    <Input
                                        className="h-6 text-xs font-mono"
                                        placeholder="Type key + Enter"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                                e.preventDefault();
                                                const newKey = e.currentTarget.value.trim();
                                                const keys = [...(field.rules?.requiredKeys || []), newKey];
                                                updateRules(index, { requiredKeys: keys });
                                                e.currentTarget.value = '';
                                            }
                                        }}
                                    />
                                </div>
                            )}

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

                            {/* String Rules Panel (V2) */}
                            {field.type === 'string' && field.widget !== 'json-input' && (
                                <div className="space-y-2 bg-muted/30 p-2 rounded">
                                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">String Validation</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <Label className="text-[10px]">Min Length</Label>
                                            <Input
                                                type="number"
                                                className="h-6 text-xs p-1"
                                                value={field.rules?.minLength ?? ''}
                                                onChange={e => updateRules(index, { minLength: e.target.value ? Number(e.target.value) : undefined })}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px]">Max Length</Label>
                                            <Input
                                                type="number"
                                                className="h-6 text-xs p-1"
                                                value={field.rules?.maxLength ?? ''}
                                                onChange={e => updateRules(index, { maxLength: e.target.value ? Number(e.target.value) : undefined })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px]">Pattern (Regex)</Label>
                                        <Input
                                            className="h-6 text-xs font-mono p-1"
                                            placeholder="^[a-zA-Z0-9]+$"
                                            value={field.rules?.pattern ?? ''}
                                            onChange={e => updateRules(index, { pattern: e.target.value || undefined })}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px]">Format Preset</Label>
                                        <Select
                                            value={field.rules?.format || 'none'}
                                            onValueChange={(v) => updateRules(index, { format: v === 'none' ? undefined : v })}
                                        >
                                            <SelectTrigger className="h-6 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">None</SelectItem>
                                                <SelectItem value="email">Email</SelectItem>
                                                <SelectItem value="url">URL</SelectItem>
                                                <SelectItem value="date">Date</SelectItem>
                                                <SelectItem value="datetime">DateTime</SelectItem>
                                                <SelectItem value="uuid">UUID</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}

                            {field.widget === 'select' && (
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