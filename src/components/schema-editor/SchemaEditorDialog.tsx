// SchemaEditorDialog - Full screen split configuration dialog

import { PanelProps, SchemaEditorProps } from './types';
import { SchemaJsonPanel } from './SchemaJsonPanel';
import { SchemaVisualPanel } from './SchemaVisualPanel';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Maximize2, Minimize2, PanelLeftClose, PanelLeft, Code2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

interface DialogProps extends SchemaEditorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SchemaEditorDialog({
    schema = [],
    onChange,
    open,
    onOpenChange,
    title = "Schema Editor"
}: DialogProps) {
    const [layout, setLayout] = useState<'split' | 'visual' | 'json'>('split');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] w-[1400px] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden" aria-describedby={undefined}>
                <DialogHeader className="px-5 py-3 border-b h-14 flex flex-row items-center justify-between shrink-0 space-y-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    <div className="flex items-center gap-4">
                        <DialogTitle className="text-sm font-semibold tracking-tight">{title}</DialogTitle>
                        <Separator orientation="vertical" className="h-4" />

                        {/* View Toggles */}
                        <div className="flex items-center gap-1 bg-muted/50 p-0.5 rounded-md border">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setLayout('visual')}
                                className={cn("h-6 px-2 text-[10px] gap-1.5", layout === 'visual' && "bg-background shadow-sm")}
                            >
                                <PanelLeft className="h-3 w-3" /> Visual
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setLayout('split')}
                                className={cn("h-6 px-2 text-[10px] gap-1.5", layout === 'split' && "bg-background shadow-sm")}
                            >
                                <PanelLeftClose className="h-3 w-3 rotate-180" /> Split
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setLayout('json')}
                                className={cn("h-6 px-2 text-[10px] gap-1.5", layout === 'json' && "bg-background shadow-sm")}
                            >
                                <Code2 className="h-3 w-3" /> JSON
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 min-h-0 flex bg-muted/10">
                    {/* Visual Panel */}
                    <div className={cn(
                        "h-full min-w-0 transition-all duration-300 ease-in-out border-r bg-background",
                        layout === 'split' ? "w-[50%]" : layout === 'visual' ? "w-full" : "w-0 hidden"
                    )}>
                        <SchemaVisualPanel schema={schema} onChange={onChange} />
                    </div>

                    {/* JSON Panel */}
                    <div className={cn(
                        "h-full min-w-0 transition-all duration-300 ease-in-out bg-background",
                        layout === 'split' ? "w-[50%]" : layout === 'json' ? "w-full" : "w-0 hidden"
                    )}>
                        <SchemaJsonPanel schema={schema} onChange={onChange} />
                    </div>
                </div>

                <div className="h-10 border-t bg-muted/40 shrink-0 flex items-center justify-between px-4">
                    <span className="text-[10px] text-muted-foreground font-medium">
                        {schema.length} fields defined
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-7 text-xs">
                        Done
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
