import { FormAssetContent, Asset } from '@/types/assets';
import { ScrollArea } from "@/components/ui/scroll-area";

interface ViewProps {
    asset: Asset;
}

export function FormAssetView({ asset }: ViewProps) {
    const content = asset.content as FormAssetContent;
    const { schema, values } = content;
    
    if (!schema || schema.length === 0) {
        return (
            <div className="flex flex-col w-full h-full text-xs items-center justify-center text-muted-foreground italic">
                <span className="mb-1">Empty Form</span>
                <span className="text-[9px] opacity-70">Use Inspector to add fields</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full h-full text-xs font-mono">
             <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 select-none flex items-center justify-between">
                <span>{asset.metadata.name || 'Parameters'}</span>
                <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[9px] font-bold">FORM</span>
             </div>
             
             <ScrollArea className="flex-1 w-full -mr-2 pr-2">
                <div className="space-y-1.5 pb-2">
                    {schema.map(field => {
                        const val = values[field.key];
                        // Validation check (simple)
                        const isMissing = field.rules?.required && (val === undefined || val === '' || val === null);
                        
                        return (
                            <div key={field.id} className="flex items-center justify-between gap-2 overflow-hidden group">
                                <span className={`shrink-0 max-w-[80px] truncate ${isMissing ? 'text-destructive font-bold' : 'text-muted-foreground'}`} title={field.label || field.key}>
                                    {field.label || field.key}:
                                </span>
                                <span className="text-foreground truncate font-medium bg-muted/50 px-1.5 py-0.5 rounded max-w-[120px]" title={String(val)}>
                                    {val === undefined || val === '' ? <span className="text-muted-foreground/50">-</span> : String(val)}
                                </span>
                            </div>
                        );
                    })}
                </div>
             </ScrollArea>
        </div>
    );
}