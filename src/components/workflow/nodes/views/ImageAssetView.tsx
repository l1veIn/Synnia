import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Asset } from '@/types/assets';
import { useState, useEffect } from 'react';

interface AssetViewProps {
    asset: Asset;
    isReadOnly: boolean;
    onUpdate: (content: any) => void;
}

export function ImageAssetView({ asset, isReadOnly, onUpdate }: AssetViewProps) {
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
            <Label className="text-xs text-muted-foreground select-none">Asset URL</Label>
            <Input 
                value={localContent}
                onChange={(e) => setLocalContent(e.target.value)}
                onBlur={handleBlur}
                disabled={isReadOnly}
                className="text-xs nodrag"
                placeholder="https://..."
            />
             {localContent && (
              <div className="mt-2 rounded-md overflow-hidden border bg-muted aspect-video relative group">
                <img src={localContent} alt="Preview" className="object-cover w-full h-full" />
              </div>
            )}
        </div>
    );
}
