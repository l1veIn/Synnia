// SchemaEditor - Inline entry point

import { useState } from 'react';
import { SchemaEditorProps } from './types';
import { SchemaEditorDialog } from './SchemaEditorDialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Maximize2, Edit2, LayoutList,
    ArrowDownToLine, ArrowUpFromLine
} from 'lucide-react';
import { widgetRegistry } from '@/components/workflow/widgets';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { FieldDefinition } from '@/types/assets';

export * from './SchemaEditorDialog'; // Export Dialog for standalone use
export * from './SchemaVisualPanel';  // Export Panel for standalone use
export * from './SchemaJsonPanel';    // Export Panel for standalone use

interface SchemaEditorExtendedProps extends SchemaEditorProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function SchemaEditor(props: SchemaEditorExtendedProps) {
    const { schema, onChange, title = "Fields Config", readOnly, open: controlledOpen, onOpenChange: controlledOnOpenChange } = props;
    const [internalOpen, setInternalOpen] = useState(false);

    const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
    const setIsOpen = controlledOnOpenChange || setInternalOpen;

    // Render an inline simplified list
    // This is read-only in terms of structure, but provides entry to the full editor
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                    <LayoutList className="h-3.5 w-3.5" />
                    {title}
                </Label>
                <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => setIsOpen(true)}
                    disabled={readOnly}
                >
                    <Edit2 className="h-3 w-3" />
                    Edit Schema
                </Button>
            </div>

            <div className="rounded-md border bg-muted/20 divide-y overflow-hidden max-h-[300px] overflow-y-auto">
                {schema.length === 0 ? (
                    <div className="p-8 flex flex-col items-center justify-center text-muted-foreground gap-2 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => !readOnly && setIsOpen(true)}>
                        <p className="text-sm font-medium">No fields defined</p>
                        <p className="text-xs opacity-60">Click "Edit Schema" to configure</p>
                    </div>
                ) : (
                    schema.map((field, idx) => (
                        <InlineFieldRow key={field.key || idx} field={field} />
                    ))
                )}
            </div>

            <SchemaEditorDialog
                {...props}
                open={isOpen}
                onOpenChange={setIsOpen}
            />
        </div>
    );
}

function InlineFieldRow({ field }: { field: FieldDefinition }) {
    const widgetDef = widgetRegistry.get(field.widget || 'text');
    const Icon = widgetDef?.meta?.icon;

    return (
        <div className="flex items-center p-2 gap-3 hover:bg-muted/30 transition-colors">
            {/* Icon */}
            <div className="w-6 h-6 rounded flex items-center justify-center bg-background border shrink-0 text-muted-foreground">
                {Icon && <Icon className="h-3 w-3" />}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className="font-mono text-xs font-medium">{field.key}</span>
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border">
                    {widgetDef?.meta?.label}
                </span>

                {/* Badges */}
                <div className="flex items-center gap-1 ml-auto">
                    {field.required && (
                        <span className="text-[9px] text-destructive border border-destructive/20 bg-destructive/5 px-1 rounded uppercase font-medium">
                            Req
                        </span>
                    )}

                    {(field.connection === 'input' || field.connection === 'both') && (
                        <ArrowDownToLine className="h-3 w-3 text-primary opacity-70" />
                    )}
                    {(field.connection === 'output' || field.connection === 'both') && (
                        <ArrowUpFromLine className="h-3 w-3 text-orange-500 opacity-70" />
                    )}
                </div>
            </div>
        </div>
    );
}

// Re-export InlineSchemaEditor for backward compatibility if needed, 
// though we prefer SchemaEditor as the main entry
export const InlineSchemaEditor = SchemaEditor;
