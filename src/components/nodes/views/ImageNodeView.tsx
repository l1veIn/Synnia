import { useMemo } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Image as ImageIcon } from 'lucide-react';
import { AssetData } from '@/types/project';
import { isImageAsset } from '@/types/assets';

interface ImageNodeViewProps {
    data: AssetData;
    projectPath?: string;
}

export function ImageNodeView({ data, projectPath }: ImageNodeViewProps) {
    const imageUrl = useMemo(() => {
        // Type Guard: Ensure it's really an image asset before accessing specific props
        if (!isImageAsset(data)) return null;

        const contentStr = data.properties.content || data.properties.src; // Now typed!
        
        if (contentStr) {
            if (contentStr.startsWith('http') || contentStr.startsWith('data:')) {
                return contentStr;
            }
            // Mock/Detached mode check
            if (projectPath && !projectPath.startsWith('mock')) {
                const rawPath = `${projectPath}/${contentStr}`;
                const normalizedPath = rawPath.replace(/\\/g, '/').replace(/\/+/g, '/');
                return convertFileSrc(normalizedPath);
            }
             return contentStr; 
        }
        return null;
    }, [data, projectPath]);

    return (
        <div className="w-full h-full bg-secondary/50 flex items-center justify-center overflow-hidden">
            {imageUrl ? (
                <img src={imageUrl} alt="preview" className="w-full h-full object-cover pointer-events-none" />
            ) : (
                <div className="text-muted-foreground/30 flex flex-col items-center gap-2">
                    <ImageIcon className="w-8 h-8" />
                </div>
            )}
        </div>
    );
}
