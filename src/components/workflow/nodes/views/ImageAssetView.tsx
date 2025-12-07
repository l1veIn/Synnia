import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Asset } from '@/types/assets';
import { useState, useEffect } from 'react';
import { useWorkflowStore } from '@/store/workflowStore';
import { convertFileSrc } from '@tauri-apps/api/core';
import { join } from '@tauri-apps/api/path';

interface AssetViewProps {
    asset: Asset;
    isReadOnly: boolean;
    onUpdate: (content: any) => void;
}

export function ImageAssetView({ asset, isReadOnly, onUpdate }: AssetViewProps) {
    const serverPort = useWorkflowStore(s => s.serverPort);
    const [localContent, setLocalContent] = useState('');
    
    // Resolve content using Local Server
    useEffect(() => {
        let raw = asset.content;

        // Robustness: Handle Legacy Object Format { src: ... }
        if (typeof raw === 'object' && raw !== null && 'src' in raw) {
            raw = (raw as any).src;
        }

        if (typeof raw !== 'string') {
            setLocalContent('');
            return;
        }

        // 1. Relative Path (assets/xxx.png) + Server Port Ready
        if ((raw.startsWith('assets/') || raw.startsWith('assets\\')) && serverPort) {
            // Extract filename safely
            const filename = raw.replace(/\\/g, '/').split('/').pop();
            const url = `http://localhost:${serverPort}/assets/${filename}`;
            setLocalContent(url);
        } 
        // 2. Absolute/Remote/Base64
        else if (raw.startsWith('http') || raw.startsWith('data:')) {
            setLocalContent(raw);
        }
        // 3. Fallback (e.g. Waiting for port)
        else {
            // Keep empty or show placeholder? Empty until port loads.
        }
    }, [asset.content, serverPort]);

    const handleBlur = () => {
         // Editing URL manually is rare for Image Asset now (imported files).
         // But if user pastes a URL:
         if (!isReadOnly && localContent !== asset.content && !localContent.startsWith('asset://')) {
            onUpdate(localContent);
        }
    };

    const { width, height } = asset.metadata.image || {};

    return (
        <div className="flex flex-col w-full h-full gap-1.5">
            <Label className="text-xs text-muted-foreground select-none shrink-0">
                {asset.metadata.name || 'Image Asset'}
            </Label>
             {localContent && (
              <div 
                className="relative w-full flex-1 min-h-[100px] rounded-md overflow-hidden border bg-muted"
              >
                <img 
                    src={localContent} 
                    alt="Preview" 
                    loading="eager"
                    className="absolute inset-0 w-full h-full object-cover" 
                    onError={(e) => console.error("Image load failed", localContent, e)}
                />
              </div>
            )}
            
            {/* Show metadata debug */}
            <div className="text-[10px] text-muted-foreground font-mono shrink-0">
                {width ? `${width}x${height}` : ''}
            </div>
        </div>
    );
}
