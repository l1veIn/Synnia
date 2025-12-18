// ImagePicker Widget
// Unified image input: URL, upload, asset library, or node connection

import { useState, useRef, useCallback } from 'react';
import { ImageIcon, Link2, Upload, FolderOpen, X, Image as ImagePreview } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ImagePickerValue, fileToBase64, isValidUrl } from '@/lib/utils/image';

interface ImagePickerProps {
    value?: ImagePickerValue;
    onChange: (value: ImagePickerValue | undefined) => void;
    disabled?: boolean;
    isConnected?: boolean;
    connectedLabel?: string;
}

export function ImagePicker({
    value,
    onChange,
    disabled,
    isConnected,
    connectedLabel = 'Connected to node'
}: ImagePickerProps) {
    const [urlInput, setUrlInput] = useState('');
    const [showUrlInput, setShowUrlInput] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Get preview URL
    const previewUrl = value?.url || (value?.base64 ? `data:${value.mimeType || 'image/png'};base64,${value.base64}` : undefined);

    // Handle file upload
    const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const dataUrl = await fileToBase64(file);
            const base64 = dataUrl.split(',')[1];
            onChange({
                source: 'base64',
                base64,
                mimeType: file.type,
                fileName: file.name,
            });
        } catch (err) {
            console.error('Failed to read file:', err);
        }
    }, [onChange]);

    // Handle URL submit
    const handleUrlSubmit = useCallback(() => {
        if (urlInput && isValidUrl(urlInput)) {
            onChange({
                source: 'url',
                url: urlInput,
            });
            setUrlInput('');
            setShowUrlInput(false);
        }
    }, [urlInput, onChange]);

    // Handle clear
    const handleClear = useCallback(() => {
        onChange(undefined);
    }, [onChange]);

    // If connected to node
    if (isConnected) {
        return (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-primary/30 bg-primary/5">
                <div className="flex items-center justify-center w-8 h-8 rounded bg-primary/10">
                    <Link2 className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-primary truncate">{connectedLabel}</p>
                    <p className="text-[10px] text-muted-foreground">Image will be provided by connected node</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {/* Preview or Placeholder */}
            <div
                className={cn(
                    "relative flex items-center justify-center w-full aspect-video rounded-lg border-2 border-dashed transition-colors",
                    disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-primary/50",
                    value ? "border-border bg-muted/30" : "border-muted-foreground/20 bg-muted/10"
                )}
                onClick={() => !disabled && !value && fileInputRef.current?.click()}
            >
                {previewUrl ? (
                    <>
                        <img
                            src={previewUrl}
                            alt="Preview"
                            className="max-w-full max-h-full object-contain rounded-md"
                        />
                        {!disabled && (
                            <Button
                                variant="secondary"
                                size="icon"
                                className="absolute top-1 right-1 h-6 w-6"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleClear();
                                }}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        )}
                    </>
                ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <ImageIcon className="h-8 w-8" />
                        <p className="text-xs">Click to upload or use buttons below</p>
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            {!disabled && !value && (
                <div className="flex items-center gap-2">
                    {/* Upload */}
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-xs"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Upload className="h-3.5 w-3.5 mr-1.5" />
                        Upload
                    </Button>

                    {/* URL Input */}
                    <Popover open={showUrlInput} onOpenChange={setShowUrlInput}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="flex-1 h-8 text-xs">
                                <Link2 className="h-3.5 w-3.5 mr-1.5" />
                                URL
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72" align="start">
                            <div className="space-y-2">
                                <Label className="text-xs">Image URL</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={urlInput}
                                        onChange={(e) => setUrlInput(e.target.value)}
                                        placeholder="https://..."
                                        className="h-8 text-xs"
                                        onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                                    />
                                    <Button size="sm" className="h-8" onClick={handleUrlSubmit}>
                                        Add
                                    </Button>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Asset Library (placeholder for future) */}
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-xs"
                        disabled
                        title="Coming soon"
                    >
                        <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
                        Library
                    </Button>
                </div>
            )}

            {/* Hidden File Input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
            />

            {/* Info when has value */}
            {value && (
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="uppercase font-medium">{value.source}</span>
                    {value.fileName && <span className="truncate">• {value.fileName}</span>}
                    {value.url && <span className="truncate">• {value.url.slice(0, 30)}...</span>}
                </div>
            )}
        </div>
    );
}
