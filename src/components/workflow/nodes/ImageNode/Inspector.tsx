import { useAsset } from '@/hooks/useAsset';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Edit2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useWorkflowStore } from '@/store/workflowStore';
import { SynniaImageEditor } from '@/components/ui/synnia-image-editor';

export const Inspector = ({ assetId }: { assetId: string }) => {
    const { asset, setContent } = useAsset(assetId);
    const serverPort = useWorkflowStore(s => s.serverPort);
    const [imageUrl, setImageUrl] = useState('');
    const [isEditorOpen, setIsEditorOpen] = useState(false);

    useEffect(() => {
        if (!asset) return;
        let raw = asset.content;

        if (typeof raw === 'object' && raw !== null && 'src' in raw) {
            raw = (raw as any).src;
        }

        if (typeof raw !== 'string') {
            setImageUrl('');
            return;
        }

        if ((raw.startsWith('assets/') || raw.startsWith('assets\\\\')) && serverPort) {
            const filename = raw.replace(/\\\\/g, '/').split('/').pop();
            const url = `http://localhost:${serverPort}/assets/${filename}`;
            setImageUrl(url);
        }
        else if (raw.startsWith('http') || raw.startsWith('data:')) {
            setImageUrl(raw);
        } else {
            setImageUrl('');
        }
    }, [asset?.content, serverPort]);

    const handleSaveImage = async (blob: Blob) => {
        try {
            // Convert blob to base64 for backend processing
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64data = reader.result as string;

                // Call backend to save as file and get path
                const { apiClient } = await import('@/lib/apiClient');
                const result = await apiClient.saveProcessedImage(base64data);

                // Update asset with file path (not base64!)
                setContent(result.relativePath);

                // Update metadata with new dimensions
                if (asset && result.width && result.height) {
                    const { graphEngine } = await import('@/lib/engine/GraphEngine');
                    graphEngine.assets.updateMetadata(assetId, {
                        image: {
                            width: result.width,
                            height: result.height,
                            size: asset.metadata.image?.size ?? null,
                            mimeType: asset.metadata.image?.mimeType ?? null,
                            thumbnail: result.thumbnailPath ?? null,
                            hash: asset.metadata.image?.hash ?? null
                        }
                    });
                }
            };
        } catch (e) {
            console.error('Failed to save processed image:', e);
        }
    };

    if (!asset) return <div className="p-4 text-xs">Asset Not Found</div>;

    let src = '';
    if (typeof asset.content === 'string') src = asset.content;
    else if (typeof asset.content === 'object' && asset.content && 'src' in asset.content) src = (asset.content as any).src;

    return (
        <div className="p-4 space-y-4">
            {imageUrl && (
                <div className="flex flex-col w-full gap-1.5">
                    <Label className="text-xs text-muted-foreground select-none shrink-0">
                        Image Preview
                    </Label>
                    <div className="min-h-[100px] max-h-[300px] flex items-center justify-center rounded-md overflow-hidden border bg-muted">
                        <img src={imageUrl} alt={asset.metadata?.name} className="max-w-full max-h-full object-contain" />
                    </div>
                </div>
            )}
            <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Source URL / Path</Label>
                <Input
                    className="text-xs font-mono"
                    value={src}
                    onChange={(e) => setContent(e.target.value)}
                />
            </div>
            <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Dimensions</Label>
                <div className="text-xs bg-muted p-2 rounded">
                    {asset.metadata.image?.width || '?'} x {asset.metadata.image?.height || '?'} px
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
