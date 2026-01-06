import { useMemo, useCallback, useState } from 'react';
import { PanelProps } from './types';
import { FieldDefinition, FieldType, WidgetType } from '@/types/assets';
import { widgetRegistry, WidgetDefinition } from '@/components/workflow/widgets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import {
    Plus, Trash2, ChevronDown,
    ArrowDownToLine, ArrowUpFromLine,
    Link2, Link2Off, Eye, EyeOff,
    CornerDownRight, ArrowRight, FolderTree, Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function SchemaVisualPanel({ schema, onChange, className }: PanelProps) {
    // Navigation State: stack of indices pointing to nested fields
    // [] = root
    // [0] = inside first field's schema (e.g. object property)
    // [0, 1] = inside second field of the first field's schema
    const [viewPath, setViewPath] = useState<number[]>([]);

    // Get all widgets
    const allWidgets = useMemo(() => widgetRegistry.getAll(), []);
    const widgetsByCategory = useMemo(() => {
        const grouped: Record<string, WidgetDefinition[]> = {
            text: [], number: [], selection: [], media: [], data: [], other: [],
        };
        allWidgets.forEach(w => {
            const cat = w.meta?.category || 'other';
            grouped[cat]?.push(w) || grouped.other.push(w);
        });
        return grouped;
    }, [allWidgets]);

    // --- Helpers for Nested Logic ---

    // Get the schema array at the current view path
    const currentSchema = useMemo(() => {
        let current = schema;
        for (const index of viewPath) {
            if (!current[index]) return []; // Should not happen
            current = current[index].schema || [];
        }
        return current;
    }, [schema, viewPath]);

    // Get breadcrumb items for display
    const breadcrumbs = useMemo(() => {
        const items = [{ label: 'Root', path: [] as number[] }];
        let current = schema;
        let currentPath: number[] = [];

        for (const index of viewPath) {
            const field = current[index];
            currentPath = [...currentPath, index];
            if (field) {
                items.push({ label: field.label || field.key, path: currentPath });
                current = field.schema || [];
            }
        }
        return items;
    }, [schema, viewPath]);

    // Recursive update helper
    const updateSchemaAtPath = useCallback((
        rootSchema: FieldDefinition[],
        path: number[],
        updater: (targetSchema: FieldDefinition[]) => FieldDefinition[]
    ): FieldDefinition[] => {
        if (path.length === 0) {
            return updater(rootSchema);
        }

        const [currIndex, ...restPath] = path;
        const newSchema = [...rootSchema];
        const field = { ...newSchema[currIndex] };

        // Ensure schema array exists if we are traversing into it
        const childSchema = field.schema || [];

        field.schema = updateSchemaAtPath(childSchema, restPath, updater);
        newSchema[currIndex] = field;

        return newSchema;
    }, []);

    // --- Actions ---

    const handleAddField = useCallback(() => {
        onChange(updateSchemaAtPath(schema, viewPath, (target) => {
            const newField: FieldDefinition = {
                key: `field_${target.length + 1}`,
                label: `Field ${target.length + 1}`,
                type: 'string',
                widget: 'text',
            };
            return [...target, newField];
        }));
    }, [schema, viewPath, onChange, updateSchemaAtPath]);

    const updateFieldLocal = useCallback((index: number, updates: Partial<FieldDefinition>) => {
        onChange(updateSchemaAtPath(schema, viewPath, (target) => {
            const newTarget = [...target];
            newTarget[index] = { ...newTarget[index], ...updates };
            return newTarget;
        }));
    }, [schema, viewPath, onChange, updateSchemaAtPath]);

    const updateConfigLocal = useCallback((index: number, updates: Record<string, any>) => {
        onChange(updateSchemaAtPath(schema, viewPath, (target) => {
            const newTarget = [...target];
            const field = newTarget[index];
            newTarget[index] = { ...field, config: { ...field.config || {}, ...updates } };
            return newTarget;
        }));
    }, [schema, viewPath, onChange, updateSchemaAtPath]);

    const removeFieldLocal = useCallback((index: number) => {
        onChange(updateSchemaAtPath(schema, viewPath, (target) => {
            return target.filter((_, i) => i !== index);
        }));
    }, [schema, viewPath, onChange, updateSchemaAtPath]);

    const handleWidgetChange = useCallback((index: number, widgetId: string) => {
        const widget = widgetRegistry.get(widgetId);
        const impliedType = widget?.meta?.outputType;

        // Reset specific props when widget changes
        updateFieldLocal(index, {
            widget: widgetId as WidgetType,
            type: impliedType || currentSchema[index].type,
            connection: undefined,
            config: undefined,
            // If changing to a non-container widget, we might want to warn about losing nested schema?
            // For now, we preserve 'schema' property even if widget changes, unless explicitly cleared.
        });
    }, [updateFieldLocal, currentSchema]);

    const getWidgetDef = (id: string) => widgetRegistry.get(id);

    return (
        <div className={cn("flex flex-col h-full min-h-0", className)}>
            {/* Header / Breadcrumbs */}
            <div className="flex flex-col border-b shrink-0 bg-muted/20">
                <div className="flex items-center gap-1 px-4 py-2 text-xs overflow-x-auto whitespace-nowrap hide-scrollbar">
                    {breadcrumbs.map((item, idx) => (
                        <div key={idx} className="flex items-center">
                            {idx > 0 && <span className="mx-1 text-muted-foreground/40">/</span>}
                            <button
                                onClick={() => setViewPath(item.path)}
                                className={cn(
                                    "hover:underline underline-offset-2 font-medium transition-colors",
                                    idx === breadcrumbs.length - 1
                                        ? "text-foreground cursor-default hover:no-underline"
                                        : "text-muted-foreground hover:text-primary"
                                )}
                                disabled={idx === breadcrumbs.length - 1}
                            >
                                {item.label}
                            </button>
                        </div>
                    ))}
                </div>

                <div className="flex items-center justify-between px-4 pb-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                        {viewPath.length > 0 ? <CornerDownRight className="h-3 w-3" /> : null}
                        {viewPath.length > 0 ? 'Nested Fields' : 'Root Fields'}
                    </Label>
                    <Button size="sm" onClick={handleAddField} className="h-6 text-xs bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90">
                        <Plus className="h-3 w-3 mr-1" /> Add Field
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {currentSchema.map((field, index) => {
                    const widgetDef = getWidgetDef(field.widget || 'text');
                    const IconComponent = widgetDef?.meta?.icon;
                    // Check if this field can contain children (has schema prop or is object/array type)
                    // We allow drilling down if the field type is object/array OR if it already has a schema
                    const canHaveChildren = field.type === 'object' || field.type === 'array' || (field.schema && field.schema.length > 0);
                    const childCount = field.schema?.length || 0;

                    return (
                        <Collapsible key={field.key || `field-${index}`} className="border rounded-lg bg-card shadow-sm group/card">
                            <div className="flex items-center p-3 gap-3">
                                {/* Icon */}
                                <div className={cn(
                                    "w-9 h-9 rounded-md flex items-center justify-center shrink-0 border transition-colors",
                                    "bg-muted/50 group-hover/card:bg-muted group-hover/card:border-primary/20",
                                    canHaveChildren && "border-blue-200/50 bg-blue-50/50 dark:bg-blue-950/20"
                                )}>
                                    {IconComponent && <IconComponent className="h-4 w-4 text-muted-foreground" />}
                                </div>

                                {/* Header Content */}
                                <CollapsibleTrigger className="flex-1 text-left min-w-0 flex items-center cursor-pointer select-none group/trigger">
                                    <div className="flex-1 min-w-0 space-y-0.5">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs font-medium">{field.key}</span>
                                            {field.required && (
                                                <Badge variant="destructive" className="h-3.5 px-1 py-0 text-[9px] uppercase tracking-wider">Req</Badge>
                                            )}
                                            {canHaveChildren && (
                                                <Badge variant="secondary" className="h-3.5 px-1.5 py-0 text-[9px] font-normal text-muted-foreground gap-1">
                                                    <Layers className="h-3 w-3" />
                                                    {childCount}
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                                            <span>{field.label}</span>
                                            <span className="text-border">•</span>
                                            <span>{widgetDef?.meta?.label || field.widget}</span>
                                        </div>
                                    </div>

                                    {/* Connection Indicators */}
                                    <div className="flex items-center gap-1 mr-2 px-2 border-l border-r border-transparent group-hover/card:border-border/50 transition-colors">
                                        {(field.connection === 'input' || field.connection === 'both') && (
                                            <ArrowDownToLine className="h-3.5 w-3.5 text-primary opacity-60" />
                                        )}
                                        {(field.connection === 'output' || field.connection === 'both') && (
                                            <ArrowUpFromLine className="h-3.5 w-3.5 text-orange-500 opacity-60" />
                                        )}
                                    </div>

                                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]/card:rotate-180 opacity-50 group-hover/card:opacity-100" />
                                </CollapsibleTrigger>

                                {/* Delete */}
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0 opacity-0 group-hover/card:opacity-100 transition-opacity"
                                    onClick={() => removeFieldLocal(index)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>

                            <CollapsibleContent className="border-t bg-muted/5 px-4 pb-4 pt-4 space-y-4">
                                {/* Drill Down Button for Containers */}
                                {canHaveChildren && (
                                    <div className="flex items-center justify-between p-2 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/50 rounded-md mb-2">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <FolderTree className="h-3.5 w-3.5 text-blue-500" />
                                            <span>Container Config</span>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className="h-6 text-xs gap-1.5 bg-background border shadow-sm hover:text-primary"
                                            onClick={() => setViewPath([...viewPath, index])}
                                        >
                                            Edit Nested Fields <ArrowRight className="h-3 w-3" />
                                        </Button>
                                    </div>
                                )}

                                {/* Row 1: Key, Label, Widget */}
                                <div className="grid grid-cols-12 gap-3">
                                    <div className="col-span-4 space-y-1.5">
                                        <Label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Variable Key</Label>
                                        <Input
                                            className="h-8 text-xs font-mono bg-background"
                                            value={field.key}
                                            onChange={e => updateFieldLocal(index, { key: e.target.value })}
                                            placeholder="my_variable"
                                        />
                                    </div>
                                    <div className="col-span-4 space-y-1.5">
                                        <Label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Display Label</Label>
                                        <Input
                                            className="h-8 text-xs bg-background"
                                            value={field.label}
                                            onChange={e => updateFieldLocal(index, { label: e.target.value })}
                                            placeholder="My Label"
                                        />
                                    </div>
                                    <div className="col-span-4 space-y-1.5">
                                        <Label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Widget Type</Label>
                                        <Select
                                            value={field.widget || 'text'}
                                            onValueChange={(v) => handleWidgetChange(index, v)}
                                        >
                                            <SelectTrigger className="h-8 text-xs bg-background">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent align="end" className="w-[200px]">
                                                {Object.entries(widgetsByCategory).map(([category, widgets]) => (
                                                    widgets.length > 0 && (
                                                        <div key={category}>
                                                            <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground/70 uppercase bg-muted/20">
                                                                {category}
                                                            </div>
                                                            {widgets.map(w => {
                                                                const Icon = w.meta?.icon;
                                                                return (
                                                                    <SelectItem key={w.id} value={w.id} className="text-xs py-1.5">
                                                                        <div className="flex items-center gap-2">
                                                                            {Icon && <Icon className="h-3.5 w-3.5 opacity-70" />}
                                                                            <span>{w.meta?.label || w.id}</span>
                                                                        </div>
                                                                    </SelectItem>
                                                                );
                                                            })}
                                                        </div>
                                                    )
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {/* Row 2: Behaviors */}
                                <div className="grid grid-cols-1 gap-3 pt-1">
                                    <div className="flex flex-col gap-2">
                                        <Label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1.5 border-b pb-1">
                                            <Link2 className="h-3 w-3" /> Field Behavior
                                        </Label>

                                        <div className="grid grid-cols-2 gap-4">
                                            {/* Connection Settings */}
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] text-muted-foreground">Connection Ports</Label>
                                                <ToggleGroup
                                                    type="single"
                                                    size="sm"
                                                    value={field.connection || 'none'}
                                                    onValueChange={(val) => updateFieldLocal(index, { connection: val === 'none' ? undefined : val as any })}
                                                    className="justify-start inline-flex border rounded-md p-0.5 bg-background h-8 w-full"
                                                >
                                                    <ToggleGroupItem value="none" className="flex-1 h-7 text-[10px] data-[state=on]:bg-muted" title="No Ports">
                                                        None
                                                    </ToggleGroupItem>
                                                    <ToggleGroupItem
                                                        value="input"
                                                        disabled={!widgetDef?.meta?.supportsInput}
                                                        className="flex-1 h-7 text-[10px] data-[state=on]:bg-primary/10 data-[state=on]:text-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                                        title={widgetDef?.meta?.supportsInput ? "Input Port" : "Input not supported by this widget"}
                                                    >
                                                        Input
                                                    </ToggleGroupItem>
                                                    <ToggleGroupItem
                                                        value="output"
                                                        disabled={!widgetDef?.meta?.supportsOutput}
                                                        className="flex-1 h-7 text-[10px] data-[state=on]:bg-orange-500/10 data-[state=on]:text-orange-600 hover:text-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        title={widgetDef?.meta?.supportsOutput ? "Output Port" : "Output not supported by this widget"}
                                                    >
                                                        Output
                                                    </ToggleGroupItem>
                                                    <ToggleGroupItem
                                                        value="both"
                                                        disabled={!widgetDef?.meta?.supportsInput || !widgetDef?.meta?.supportsOutput}
                                                        className="flex-1 h-7 text-[10px] data-[state=on]:bg-blue-500/10 data-[state=on]:text-blue-600 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        title={(!widgetDef?.meta?.supportsInput || !widgetDef?.meta?.supportsOutput) ? "Both ports not supported" : "Both Ports"}
                                                    >
                                                        Both
                                                    </ToggleGroupItem>
                                                </ToggleGroup>
                                            </div>

                                            {/* Validation */}
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] text-muted-foreground">Validation</Label>
                                                <div className="flex items-center gap-2 h-8 border rounded-md px-3 bg-background">
                                                    <Switch
                                                        id={`req-${index}`}
                                                        checked={field.required || false}
                                                        onCheckedChange={(checked) => updateFieldLocal(index, { required: checked })}
                                                        className="scale-75 origin-left"
                                                    />
                                                    <Label htmlFor={`req-${index}`} className="text-xs cursor-pointer font-normal">
                                                        Required Field
                                                    </Label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Widget Config Section */}
                                {widgetDef?.configSchema && widgetDef.configSchema.length > 0 && (
                                    <div className="space-y-2 pt-2 border-t border-dashed">
                                        <Label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                                            {widgetDef.meta?.label} Configuration
                                        </Label>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-3 rounded-md border bg-background/50">
                                            {widgetDef.configSchema.map(configField => (
                                                <div key={configField.key} className="space-y-1.5">
                                                    <Label className="text-[10px] text-muted-foreground">{configField.label}</Label>

                                                    {configField.type === 'number' ? (
                                                        <Input
                                                            type="number"
                                                            className="h-7 text-xs bg-background"
                                                            value={field.config?.[configField.key] ?? ''}
                                                            onChange={e => updateConfigLocal(index, { [configField.key]: Number(e.target.value) })}
                                                            placeholder={String(configField.config?.placeholder || '')}
                                                        />
                                                    ) : configField.type === 'boolean' ? (
                                                        <Select
                                                            value={String(field.config?.[configField.key] ?? 'true')}
                                                            onValueChange={v => updateConfigLocal(index, { [configField.key]: v === 'true' })}
                                                        >
                                                            <SelectTrigger className="h-7 text-xs bg-background"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="true">Yes</SelectItem>
                                                                <SelectItem value="false">No</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    ) : configField.widget === 'tags' || configField.type === 'array' ? (
                                                        <Input
                                                            className="h-7 text-xs bg-background"
                                                            placeholder="A, B, C (comma separated)"
                                                            value={(field.config?.[configField.key] || []).join(', ')}
                                                            onChange={e => updateConfigLocal(index, {
                                                                [configField.key]: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                                                            })}
                                                        />
                                                    ) : (
                                                        <Input
                                                            className="h-7 text-xs bg-background"
                                                            value={field.config?.[configField.key] ?? ''}
                                                            onChange={e => updateConfigLocal(index, { [configField.key]: e.target.value || undefined })}
                                                            placeholder={String(configField.config?.placeholder || '')}
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CollapsibleContent>
                        </Collapsible>
                    );
                })}

                {currentSchema.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border-2 border-dashed rounded-xl border-muted/50 bg-muted/10">
                        <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                            <Plus className="h-6 w-6 opacity-30" />
                        </div>
                        <p className="text-sm font-medium">No fields defined</p>
                        <p className="text-xs opacity-60 mt-1">
                            {viewPath.length === 0 ? 'Click "Add Field" to start' : 'This nested schema is empty'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
