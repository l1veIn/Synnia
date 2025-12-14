/**
 * Asset Library Dialog
 * 
 * A unified view for managing media assets (images, videos, audio).
 * Features: preview, rename, view references, drag to canvas, batch import.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { apiClient, MediaAssetInfo } from '@/lib/apiClient';
import { useWorkflowStore } from '@/store/workflowStore';
import { Image, FileImage, Search, ArrowLeft, MapPin, Trash2, Loader2, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';

interface AssetLibraryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onLocateNode?: (nodeId: string) => void;
}

export const AssetLibraryDialog = ({ open, onOpenChange, onLocateNode }: AssetLibraryDialogProps) => {
    const [assets, setAssets] = useState<MediaAssetInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<MediaAssetInfo | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingName, setEditingName] = useState('');

    const nodes = useWorkflowStore(s => s.nodes);
    const serverPort = useWorkflowStore(s => s.serverPort);

    // Load assets on open
    const loadAssets = useCallback(async () => {
        setLoading(true);
        try {
            const data = await apiClient.getMediaAssets();
            setAssets(data);
        } catch (e) {
            console.error('Failed to load media assets:', e);
            toast.error('Failed to load assets');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (open) {
            loadAssets();
            setSelectedAsset(null);
        }
    }, [open, loadAssets]);

    // Filter assets by search term
    const filteredAssets = useMemo(() => {
        if (!searchTerm.trim()) return assets;
        const term = searchTerm.toLowerCase();
        return assets.filter(a =>
            a.name.toLowerCase().includes(term) ||
            a.assetType.toLowerCase().includes(term)
        );
    }, [assets, searchTerm]);

    // Find nodes that reference this asset
    const referencingNodes = useMemo(() => {
        if (!selectedAsset) return [];
        return nodes.filter(n => n.data?.assetId === selectedAsset.id);
    }, [selectedAsset, nodes]);

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

    // Get full image URL
    const getImageUrl = (asset: MediaAssetInfo) => {
        const path = asset.content;
        if (!path) return null;
        if (path.startsWith('http') || path.startsWith('data:')) return path;
        if (serverPort && (path.startsWith('assets/') || path.includes('assets\\\\'))) {
            const filename = path.replace(/\\/g, '/').split('/').pop();
            return `http://localhost:${serverPort}/assets/${filename}`;
        }
        return null;
    };

    // Handle node location
    const handleLocateNode = (nodeId: string) => {
        onOpenChange(false);
        onLocateNode?.(nodeId);
    };

    // Format date
    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[600px] p-0 flex flex-col">
                <DialogHeader className="px-6 py-4 border-b shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        <FolderOpen className="h-5 w-5 text-primary" />
                        Asset Library
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 flex min-h-0">
                    {/* Left Panel: Asset Grid */}
                    <div className={cn(
                        "flex flex-col min-h-0 border-r",
                        selectedAsset ? "w-1/2" : "flex-1"
                    )}>
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
                                    <FileImage className="h-8 w-8 mb-2 opacity-50" />
                                    <p className="text-sm">No media assets found</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 gap-2 p-3">
                                    {filteredAssets.map(asset => (
                                        <div
                                            key={asset.id}
                                            className={cn(
                                                "aspect-square rounded-lg border-2 cursor-pointer overflow-hidden bg-muted/50 hover:bg-muted transition-colors relative group",
                                                selectedAsset?.id === asset.id
                                                    ? "border-primary ring-2 ring-primary/20"
                                                    : "border-transparent hover:border-border"
                                            )}
                                            onClick={() => {
                                                setSelectedAsset(asset);
                                                setEditingName(asset.name);
                                            }}
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
                                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <p className="text-[10px] text-white truncate">{asset.name}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>

                        {/* Footer */}
                        <div className="p-3 border-t shrink-0 flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                                {filteredAssets.length} assets
                            </span>
                            <Button size="sm" variant="outline" onClick={loadAssets}>
                                Refresh
                            </Button>
                        </div>
                    </div>

                    {/* Right Panel: Asset Details */}
                    {selectedAsset && (
                        <div className="w-1/2 flex flex-col min-h-0">
                            {/* Back button (for narrow screens) */}
                            <div className="p-3 border-b shrink-0 flex items-center gap-2 md:hidden">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setSelectedAsset(null)}
                                >
                                    <ArrowLeft className="h-4 w-4 mr-1" />
                                    Back
                                </Button>
                            </div>

                            <ScrollArea className="flex-1">
                                <div className="p-4 space-y-4">
                                    {/* Preview */}
                                    <div className="aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center border">
                                        {getImageUrl(selectedAsset) ? (
                                            <img
                                                src={getImageUrl(selectedAsset)!}
                                                alt={selectedAsset.name}
                                                className="max-w-full max-h-full object-contain"
                                            />
                                        ) : (
                                            <Image className="h-12 w-12 text-muted-foreground" />
                                        )}
                                    </div>

                                    {/* Name */}
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground">Name</Label>
                                        <Input
                                            value={editingName}
                                            onChange={(e) => setEditingName(e.target.value)}
                                            className="h-8 text-sm"
                                        />
                                    </div>

                                    {/* Metadata */}
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div className="bg-muted/50 p-2 rounded">
                                            <span className="text-muted-foreground">Type</span>
                                            <p className="font-medium">{selectedAsset.assetType}</p>
                                        </div>
                                        {selectedAsset.width && selectedAsset.height && (
                                            <div className="bg-muted/50 p-2 rounded">
                                                <span className="text-muted-foreground">Dimensions</span>
                                                <p className="font-medium">{selectedAsset.width} × {selectedAsset.height}</p>
                                            </div>
                                        )}
                                        <div className="bg-muted/50 p-2 rounded col-span-2">
                                            <span className="text-muted-foreground">Updated</span>
                                            <p className="font-medium">{formatDate(selectedAsset.updatedAt)}</p>
                                        </div>
                                    </div>

                                    <Separator />

                                    {/* References */}
                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                            <MapPin className="h-3 w-3" />
                                            Referencing Nodes ({referencingNodes.length})
                                        </Label>
                                        {referencingNodes.length === 0 ? (
                                            <p className="text-xs text-muted-foreground italic">
                                                Not used by any nodes
                                            </p>
                                        ) : (
                                            <div className="space-y-1">
                                                {referencingNodes.map(node => (
                                                    <div
                                                        key={node.id}
                                                        className="flex items-center justify-between p-2 bg-muted/50 rounded text-xs"
                                                    >
                                                        <span className="truncate">{node.data?.title || node.type}</span>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-6 px-2 text-[10px]"
                                                            onClick={() => handleLocateNode(node.id)}
                                                        >
                                                            Locate
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </ScrollArea>

                            {/* Actions */}
                            <div className="p-3 border-t shrink-0 flex items-center justify-end gap-2">
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    disabled={referencingNodes.length > 0}
                                    title={referencingNodes.length > 0 ? "Cannot delete: asset is in use" : "Delete asset"}
                                >
                                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                                    Delete
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
