import { useAsset } from '@/hooks/useAsset';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Save, AlertCircle, FolderOpen, Upload } from 'lucide-react';
import { GalleryAssetContent, GalleryImage } from './index';
import { AssetPicker } from '@/components/AssetPicker';
import { MediaAssetInfo, apiClient } from '@/lib/apiClient';
import { useWorkflowStore } from '@/store/workflowStore';
import { v4 as uuidv4 } from 'uuid';
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { open as openDialog } from '@tauri-apps/plugin-dialog';

interface InspectorProps {
    assetId: string;
    nodeId?: string;
}

export function Inspector({ assetId, nodeId }: InspectorProps) {
    const { asset, setValue } = useAsset(assetId);
    const serverPort = useWorkflowStore(s => s.serverPort);
    const [isPickerOpen, setIsPickerOpen] = useState(false);

    // Get saved content - now from asset.value
    const savedContent: GalleryAssetContent = useMemo(() => {
        const raw = (asset?.value as GalleryAssetContent) || {};
        return {
            viewMode: raw.viewMode ?? 'grid',
            columnsPerRow: raw.columnsPerRow ?? 4,
            allowStar: raw.allowStar ?? true,
            allowDelete: raw.allowDelete ?? true,
            images: raw.images ?? [],
        };
    }, [asset?.value]);

    // Draft state
    const [draftViewMode, setDraftViewMode] = useState<'grid' | 'list' | 'single'>('grid');
    const [draftColumns, setDraftColumns] = useState(4);
    const [draftAllowStar, setDraftAllowStar] = useState(true);
    const [draftAllowDelete, setDraftAllowDelete] = useState(true);
    const [isInitialized, setIsInitialized] = useState(false);

    // Initialize draft from saved
    useEffect(() => {
        if (!isInitialized && asset) {
            setDraftViewMode(savedContent.viewMode);
            setDraftColumns(savedContent.columnsPerRow);
            setDraftAllowStar(savedContent.allowStar);
            setDraftAllowDelete(savedContent.allowDelete);
            setIsInitialized(true);
        }
    }, [savedContent, isInitialized, asset]);

    // Reset on asset change
    useEffect(() => {
        setDraftViewMode(savedContent.viewMode);
        setDraftColumns(savedContent.columnsPerRow);
        setDraftAllowStar(savedContent.allowStar);
        setDraftAllowDelete(savedContent.allowDelete);
        setIsInitialized(true);
    }, [assetId]);

    // Check for changes
    const hasChanges = useMemo(() => {
        if (!isInitialized) return false;
        return draftViewMode !== savedContent.viewMode ||
            draftColumns !== savedContent.columnsPerRow ||
            draftAllowStar !== savedContent.allowStar ||
            draftAllowDelete !== savedContent.allowDelete;
    }, [draftViewMode, draftColumns, draftAllowStar, draftAllowDelete, savedContent, isInitialized]);

    // Save
    const handleSave = () => {
        setValue({
            ...savedContent,
            viewMode: draftViewMode,
            columnsPerRow: draftColumns,
            allowStar: draftAllowStar,
            allowDelete: draftAllowDelete,
        });
        toast.success('Changes saved');
    };

    // Discard
    const handleDiscard = () => {
        setDraftViewMode(savedContent.viewMode);
        setDraftColumns(savedContent.columnsPerRow);
        setDraftAllowStar(savedContent.allowStar);
        setDraftAllowDelete(savedContent.allowDelete);
        toast.info('Changes discarded');
    };

    // Handle assets selected from picker
    const handleAssetsSelected = (selectedAssets: MediaAssetInfo[]) => {
        const newImages: GalleryImage[] = selectedAssets.map(asset => {
            // Resolve the correct URL/path
            let src = asset.content;
            if (serverPort && (src.startsWith('assets/') || src.includes('assets\\\\'))) {
                const filename = src.replace(/\\/g, '/').split('/').pop();
                src = `http://localhost:${serverPort}/assets/${filename}`;
            }
            return {
                id: uuidv4(),
                src,
                caption: asset.name,
                starred: false,
                mediaAssetId: asset.id, // Track the source asset
            };
        });

        setValue({
            ...savedContent,
            images: [...savedContent.images, ...newImages]
        });
        toast.success(`Added ${selectedAssets.length} image(s)`);
    };

    // Clear all images
    const clearAllImages = () => {
        setValue({ ...savedContent, images: [] });
        toast.success('All images cleared');
    };

    // Clear all stars
    const clearAllStars = () => {
        setValue({
            ...savedContent,
            images: savedContent.images.map(img => ({ ...img, starred: false }))
        });
        toast.success('All stars cleared');
    };

    if (!asset) return <div className="p-4 text-xs">Asset Not Found</div>;

    const starredCount = savedContent.images.filter(img => img.starred).length;

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Add from Asset Library */}
                <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setIsPickerOpen(true)}
                >
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Add from Library
                </Button>

                <Button
                    variant="outline"
                    className="w-full"
                    onClick={async () => {
                        const selected = await openDialog({
                            multiple: true,
                            filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }]
                        });
                        if (selected && Array.isArray(selected) && selected.length > 0) {
                            const toastId = toast.loading(`Importing ${selected.length} images...`);
                            try {
                                const results = await apiClient.batchImportImages(selected);
                                const succeeded = results.filter(r => r.result);
                                const failed = results.filter(r => r.error).length;

                                // Add imported images to gallery
                                const newImages: GalleryImage[] = succeeded.map(r => {
                                    const path = r.result!.relativePath;
                                    const src = serverPort
                                        ? `http://localhost:${serverPort}/assets/${path.split('/').pop()}`
                                        : path;
                                    return {
                                        id: uuidv4(),
                                        src,
                                        caption: r.sourcePath.split('/').pop() || 'Imported',
                                        starred: false,
                                    };
                                });

                                if (newImages.length > 0) {
                                    setValue({
                                        ...savedContent,
                                        images: [...savedContent.images, ...newImages]
                                    });
                                }

                                if (failed > 0) {
                                    toast.warning(`Added ${succeeded.length}, failed ${failed}`, { id: toastId });
                                } else {
                                    toast.success(`Added ${succeeded.length} images`, { id: toastId });
                                }
                            } catch (e) {
                                console.error('Batch import failed:', e);
                                toast.error('Import failed', { id: toastId });
                            }
                        }
                    }}
                >
                    <Upload className="h-4 w-4 mr-2" />
                    Add from Local
                </Button>

                <div className="border-t" />

                {/* Image Stats */}
                <div className="flex items-center justify-between text-xs">
                    <span>Images: {savedContent.images.length}</span>
                    {starredCount > 0 && (
                        <span className="text-yellow-500">⭐ {starredCount}</span>
                    )}
                </div>

                {/* Bulk actions */}
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={clearAllStars}
                        disabled={starredCount === 0}
                    >
                        Clear Stars
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-7 text-xs text-destructive hover:text-destructive"
                        onClick={clearAllImages}
                        disabled={savedContent.images.length === 0}
                    >
                        Clear All
                    </Button>
                </div>

                <div className="border-t" />

                {/* Display Settings */}
                <div className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">
                    Display Settings
                </div>

                {/* View Mode */}
                <div className="space-y-2">
                    <Label className="text-xs">View Mode</Label>
                    <div className="flex gap-2">
                        {(['grid', 'list', 'single'] as const).map((mode) => (
                            <Button
                                key={mode}
                                variant={draftViewMode === mode ? 'secondary' : 'ghost'}
                                size="sm"
                                className="flex-1 h-7 text-xs capitalize"
                                onClick={() => setDraftViewMode(mode)}
                            >
                                {mode}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Columns */}
                {draftViewMode === 'grid' && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs">Columns</Label>
                            <span className="text-xs text-muted-foreground">{draftColumns}</span>
                        </div>
                        <Slider
                            value={[draftColumns]}
                            onValueChange={(v) => setDraftColumns(v[0])}
                            min={2}
                            max={6}
                            step={1}
                        />
                    </div>
                )}

                {/* Toggles */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs">Allow Star</Label>
                        <Switch checked={draftAllowStar} onCheckedChange={setDraftAllowStar} />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label className="text-xs">Allow Delete</Label>
                        <Switch checked={draftAllowDelete} onCheckedChange={setDraftAllowDelete} />
                    </div>
                </div>
            </div>

            {/* Fixed Footer */}
            <div className="px-4 py-3 border-t bg-muted/10 flex items-center justify-between shrink-0">
                <div className="text-[10px] text-muted-foreground font-mono">
                    {hasChanges && (
                        <span className="text-amber-600 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Unsaved
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {hasChanges && (
                        <Button size="sm" variant="ghost" onClick={handleDiscard} className="h-7 text-xs">
                            Discard
                        </Button>
                    )}
                    <Button
                        size="sm"
                        variant={hasChanges ? "default" : "outline"}
                        onClick={handleSave}
                        className={cn("h-7 gap-1.5", hasChanges && "bg-primary")}
                        disabled={!hasChanges}
                    >
                        <Save className="h-3.5 w-3.5" />
                        Save
                    </Button>
                </div>
            </div>

            {/* Asset Picker Dialog */}
            <AssetPicker
                open={isPickerOpen}
                onOpenChange={setIsPickerOpen}
                onSelect={handleAssetsSelected}
                multiple={true}
                title="Select Images"
                assetType="image"
            />
        </div>
    );
}
