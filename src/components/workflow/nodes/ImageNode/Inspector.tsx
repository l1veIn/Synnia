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

    const handleSaveImage = (blob: Blob) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
            const base64data = reader.result as string;
            setContent(base64data);
        };
    };

    if (!asset) return <div className="p-4 text-xs">Asset Not Found</div>;
    
    let src = '';
    if (typeof asset.content === 'string') src = asset.content;
    else if (typeof asset.content === 'object' && asset.content && 'src' in asset.content) src = (asset.content as any).src;

    return (
        <div className="p-4 space-y-4">
             {imageUrl && (
                <div className="flex flex-col w-full h-full gap-1.5">
                    <Label className="text-xs text-muted-foreground select-none shrink-0">
                        Image Preview
                    </Label>
                    <div className="flex-1 min-h-[100px] flex items-center justify-center rounded-md overflow-hidden border bg-muted">
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
