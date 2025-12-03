import { AssetData } from '@/types/project';
import { FileText } from 'lucide-react';

interface TextNodeViewProps {
    data: AssetData;
}

export function TextNodeView({ data }: TextNodeViewProps) {
    // Generic fallback for content property if strict type guard isn't met
    // but we know 'properties' exists on all assets.
    const content = data.properties?.content as string || ""; 

    return (
        <div className="p-3 w-full h-full bg-background overflow-hidden relative group">
            {content ? (
                <div className="text-xs text-foreground/80 whitespace-pre-wrap font-mono break-words h-full overflow-hidden">
                    {content.slice(0, 300)}
                    {content.length > 300 && <span className="text-muted-foreground">...</span>}
                </div>
            ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                     <FileText className="w-8 h-8" />
                </div>
            )}
        </div>
    );
}