/**
 * Asset Picker Dialog
 * 
 * A reusable dialog for selecting media assets from the asset library.
 * Used by Gallery Node and other components that need to pick existing assets.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { apiClient, MediaAssetInfo } from '@/lib/apiClient';
import { useWorkflowStore } from '@/store/workflowStore';
import { Image, Search, Loader2, FolderOpen, Check } from 'lucide-react';
import { toast } from 'sonner';

interface AssetPickerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (assets: MediaAssetInfo[]) => void;
    multiple?: boolean;
    title?: string;
    assetType?: 'image' | 'video' | 'audio' | 'all';
}

export const AssetPicker = ({
    open,
    onOpenChange,
    onSelect,
    multiple = true,
    title = 'Select Images',
    assetType = 'image'
}: AssetPickerProps) => {
    const [assets, setAssets] = useState<MediaAssetInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');

    const serverPort = useWorkflowStore(s => s.serverPort);

    // Load assets on open
    const loadAssets = useCallback(async () => {
        setLoading(true);
        try {
            const data = await apiClient.getMediaAssets();
            // Filter by type if specified
            const filtered = assetType === 'all'
                ? data
                : data.filter(a => a.assetType === assetType);
            setAssets(filtered);
        } catch (e) {
            console.error('Failed to load media assets:', e);
            toast.error('Failed to load assets');
        } finally {
            setLoading(false);
        }
    }, [assetType]);

    useEffect(() => {
        if (open) {
            loadAssets();
            setSelectedIds(new Set());
            setSearchTerm('');
        }
    }, [open, loadAssets]);

    // Filter assets by search term
    const filteredAssets = useMemo(() => {
        if (!searchTerm.trim()) return assets;
        const term = searchTerm.toLowerCase();
        return assets.filter(a =>
            a.name.toLowerCase().includes(term)
        );
    }, [assets, searchTerm]);

    // Get thumbnail URL
    const getThumbnailUrl = (asset: MediaAssetInfo) => {
        const path = asset.thumbnailPath || asset.content;
        if (!path) return null;
        if (path.startsWith('http') || path.startsWith('data:')) return path;
        if (serverPort && (path.startsWith('assets/') || path.includes('assets\\\\'))) {
            const filename = path.replace(/\\/g, '/').split('/').pop();
            return `http://localhost:${serverPort}/assets/${filename}`;
        }
        return null;
    };

    // Toggle selection
    const toggleSelect = (assetId: string) => {
        if (multiple) {
            const newSet = new Set(selectedIds);
            if (newSet.has(assetId)) {
                newSet.delete(assetId);
            } else {
                newSet.add(assetId);
            }
            setSelectedIds(newSet);
        } else {
            setSelectedIds(new Set([assetId]));
        }
    };

    // Handle confirm
    const handleConfirm = () => {
        const selected = assets.filter(a => selectedIds.has(a.id));
        onSelect(selected);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl h-[500px] p-0 flex flex-col">
                <DialogHeader className="px-6 py-4 border-b shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        <FolderOpen className="h-5 w-5 text-primary" />
                        {title}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 flex flex-col min-h-0">
                    {/* Search */}
                    <div className="p-3 border-b shrink-0">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search assets..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 h-9"
                            />
                        </div>
                    </div>

                    {/* Asset Grid */}
                    <ScrollArea className="flex-1">
                        {loading ? (
                            <div className="flex items-center justify-center h-40">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : filteredAssets.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                                <Image className="h-8 w-8 mb-2 opacity-50" />
                                <p className="text-sm">No {assetType} assets found</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-4 gap-2 p-3">
                                {filteredAssets.map(asset => {
                                    const isSelected = selectedIds.has(asset.id);
                                    return (
                                        <div
                                            key={asset.id}
                                            className={cn(
                                                "aspect-square rounded-lg border-2 cursor-pointer overflow-hidden bg-muted/50 hover:bg-muted transition-colors relative group",
                                                isSelected
                                                    ? "border-primary ring-2 ring-primary/20"
                                                    : "border-transparent hover:border-border"
                                            )}
                                            onClick={() => toggleSelect(asset.id)}
                                        >
                                            {getThumbnailUrl(asset) ? (
                                                <img
                                                    src={getThumbnailUrl(asset)!}
                                                    alt={asset.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Image className="h-8 w-8 text-muted-foreground" />
                                                </div>
                                            )}

                                            {/* Selected Indicator */}
                                            {isSelected && (
                                                <div className="absolute top-2 right-2 bg-primary rounded-full p-0.5">
                                                    <Check className="h-3 w-3 text-primary-foreground" />
                                                </div>
                                            )}

                                            {/* Name on hover */}
                                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <p className="text-[10px] text-white truncate">{asset.name}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </ScrollArea>
                </div>

                <DialogFooter className="px-6 py-3 border-t shrink-0">
                    <div className="flex-1 text-xs text-muted-foreground">
                        {selectedIds.size} selected
                    </div>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm} disabled={selectedIds.size === 0}>
                        Add Selected
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
