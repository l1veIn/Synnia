import { useAsset } from '@/hooks/useAsset';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Edit2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useWorkflowStore } from '@/store/workflowStore';
import { SynniaImageEditor } from '@/components/ui/synnia-image-editor';

export const Inspector = ({ assetId }: { assetId: string }) => {
    const { asset, setValue } = useAsset(assetId);
    const serverPort = useWorkflowStore(s => s.serverPort);
    const [imageUrl, setImageUrl] = useState('');
    const [isEditorOpen, setIsEditorOpen] = useState(false);

    useEffect(() => {
        if (!asset) return;
        // New structure: value is { src, width, height, ... }
        const value = asset.value as Record<string, any>;
        const src = value?.src || '';

        if (typeof src !== 'string') {
            setImageUrl('');
            return;
        }

        if ((src.startsWith('assets/') || src.startsWith('assets\\\\')) && serverPort) {
            const filename = src.replace(/\\\\/g, '/').split('/').pop();
            const url = `http://localhost:${serverPort}/assets/${filename}`;
            setImageUrl(url);
        }
        else if (src.startsWith('http') || src.startsWith('data:')) {
            setImageUrl(src);
        } else {
            setImageUrl('');
        }
    }, [asset?.value, serverPort]);

    const handleSaveImage = async (blob: Blob) => {
        try {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64data = reader.result as string;

                const { apiClient } = await import('@/lib/apiClient');
                const result = await apiClient.saveProcessedImage(base64data);

                // Update asset value with new src and dimensions
                const currentValue = asset?.value as Record<string, any> || {};
                setValue({
                    ...currentValue,
                    src: result.relativePath,
                    width: result.width,
                    height: result.height
                });
            };
        } catch (e) {
            console.error('Failed to save processed image:', e);
        }
    };

    if (!asset) return <div className="p-4 text-xs">Asset Not Found</div>;

    // New structure: read from value object and config.meta
    const value = asset.value as Record<string, any>;
    const meta = (asset.config as any)?.meta || {};
    const src = value?.src || '';
    const width = value?.width ?? meta?.width;
    const height = value?.height ?? meta?.height;

    return (
        <div className="p-4 space-y-4">
            {imageUrl && (
                <div className="flex flex-col w-full gap-1.5">
                    <Label className="text-xs text-muted-foreground select-none shrink-0">
                        Image Preview
                    </Label>
                    <div className="min-h-[100px] max-h-[300px] flex items-center justify-center rounded-md overflow-hidden border bg-muted">
                        <img src={imageUrl} alt={asset.sys?.name} className="max-w-full max-h-full object-contain" />
                    </div>
                </div>
            )}
            <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Source URL / Path</Label>
                <Input
                    className="text-xs font-mono"
                    value={src}
                    onChange={(e) => setValue({ ...value, src: e.target.value })}
                />
            </div>
            <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Dimensions</Label>
                <div className="text-xs bg-muted p-2 rounded">
                    {width || '?'} x {height || '?'} px
                </div>
            </div>
            <Button
                variant="outline"
                size="sm"
                className="w-full flex items-center gap-2"
                onClick={() => setIsEditorOpen(true)}
                disabled={!imageUrl}
            >
                <Edit2 className="h-3.5 w-3.5" />
                Edit Image
            </Button>

            <SynniaImageEditor
                open={isEditorOpen}
                onOpenChange={setIsEditorOpen}
                src={imageUrl}
                onSave={handleSaveImage}
            />
        </div>
    );
};
