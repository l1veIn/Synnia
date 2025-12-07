import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Asset } from '@/types/assets';
import { useState, useEffect } from 'react';

interface AssetViewProps {
    asset: Asset;
    isReadOnly: boolean;
    onUpdate: (content: any) => void;
}

export function TextAssetView({ asset, isReadOnly, onUpdate }: AssetViewProps) {
    const [localContent, setLocalContent] = useState(asset.content as string || '');

    useEffect(() => {
        setLocalContent(asset.content as string || '');
    }, [asset.content]);

    const handleBlur = () => {
        if (!isReadOnly && localContent !== asset.content) {
            onUpdate(localContent);
        }
    };

    return (
        <div className="grid w-full gap-1.5">
            <Label className="text-xs text-muted-foreground select-none">
                {asset.metadata?.name || 'Text Content'}
            </Label>
            <Textarea 
                value={localContent}
                onChange={(e) => setLocalContent(e.target.value)}
                onBlur={handleBlur}
                disabled={isReadOnly}
                className="text-xs resize-y min-h-[60px] nodrag bg-background/50 focus:bg-background transition-colors"
                placeholder="Enter text..."
            />
        </div>
    );
}
