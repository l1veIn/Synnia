import { Asset } from '@/types/assets';
import { ScrollArea } from "@/components/ui/scroll-area";

interface AssetViewProps {
    asset: Asset;
}

export function JsonAssetView({ asset }: AssetViewProps) {
    let content = asset.content;
    if (typeof content === 'string') {
        try { content = JSON.parse(content); } catch { content = {}; }
    }
    const keys = Object.keys(content || {});
    
    return (
        <div className="flex flex-col w-full h-full text-xs font-mono">
             <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 select-none flex items-center justify-between">
                <span>{asset.metadata.name || 'JSON Data'}</span>
                <span className="bg-muted px-1.5 py-0.5 rounded text-[9px] font-bold">JSON</span>
             </div>
             
             {keys.length === 0 ? (
                 <div className="text-muted-foreground/50 italic flex-1 flex items-center justify-center text-[10px]">Empty</div>
             ) : (
                 <ScrollArea className="flex-1 w-full -mr-2 pr-2">
                    <div className="space-y-1.5 pb-2">
                        {keys.map(key => (
                            <div key={key} className="flex items-center justify-between gap-2 overflow-hidden">
                                <span className="text-muted-foreground shrink-0 max-w-[80px] truncate">{key}:</span>
                                <span className="text-foreground truncate font-medium bg-muted/50 px-1.5 py-0.5 rounded max-w-[120px]">{String(content[key])}</span>
                            </div>
                        ))}
                    </div>
                 </ScrollArea>
             )}
        </div>
    );
}