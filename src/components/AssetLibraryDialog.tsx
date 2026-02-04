/**
 * Asset Library Dialog - Redesigned
 * 
 * "Silky Smooth" UI with Master-Detail layout and Framer Motion animations.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { apiClient, MediaAssetInfo } from '@/lib/apiClient';
import { useWorkflowStore } from '@/store/workflowStore';
import { graphEngine } from '@core/engine/GraphEngine';
import { resolveNodeAssetId } from '@core/utils/nodeAsset';
import { Image as ImageIcon, FileImage, Search, MapPin, Trash2, Loader2, Upload, ChevronRight, ChevronDown, Copy, Code, X, Maximize2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'next-themes';
import JsonView from '@uiw/react-json-view';
import { lightTheme } from '@uiw/react-json-view/light';
import { darkTheme } from '@uiw/react-json-view/dark';
import { motion, AnimatePresence } from 'framer-motion';

// --- Types & Interfaces ---

interface AssetLibraryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onLocateNode?: (nodeId: string) => void;
}

// --- Sub-Components ---

/**
 * Collapsible JSON viewer for debugging asset data
 */
const AssetJsonViewer = ({ asset }: { asset: MediaAssetInfo }) => {
    const [isOpen, setIsOpen] = useState(false);
    const { resolvedTheme } = useTheme();

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(JSON.stringify(asset, null, 2));
        toast.success('Copied to clipboard');
    };

    const rjvTheme = resolvedTheme === 'dark' ? 'monokai' : 'rjv-default';
    const bgClass = resolvedTheme === 'dark' ? 'bg-[#272822]' : 'bg-white';

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
            <div className="rounded-lg border overflow-hidden mt-4">
                <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors select-none">
                        <div className="flex items-center gap-2">
                            {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                            <Code className="h-4 w-4 text-muted-foreground" />
                            <Label className="text-xs font-medium cursor-pointer">Debug JSON</Label>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy}>
                            <Copy className="h-3 w-3" />
                        </Button>
                    </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <div className={cn("border-t p-3 text-xs opacity-90 overflow-x-hidden w-full", bgClass)}>
                        <ScrollArea className="max-h-[200px] w-full">
                            <div className="w-full overflow-x-auto">
                                <JsonView
                                    value={asset}
                                    style={resolvedTheme === 'dark' ? darkTheme : lightTheme}
                                    collapsed={1}
                                    displayDataTypes={false}
                                />
                            </div>
                        </ScrollArea>
                    </div>
                </CollapsibleContent>
            </div>
        </Collapsible>
    );
};

// --- Main Component ---

export const AssetLibraryDialog = ({ open, onOpenChange, onLocateNode }: AssetLibraryDialogProps) => {
    const { t } = useTranslation('common');
    const [assets, setAssets] = useState<MediaAssetInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<MediaAssetInfo | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingName, setEditingName] = useState(''); // Separate state for editing name

    const nodes = useWorkflowStore(s => s.nodes);
    const storeAssets = useWorkflowStore(s => s.assets);
    const serverPort = useWorkflowStore(s => s.serverPort);

    // --- Data Loading & computed ---

    const loadAssets = useCallback(async () => {
        setLoading(true);
        try {
            const resp = await apiClient.getMediaAssets();
            // Sort by updated at descending
            const sortedItems = resp.items.sort((a, b) => b.updatedAt - a.updatedAt);
            setAssets(sortedItems);
        } catch (e) {
            console.error('Failed to load media assets:', e);
            toast.error(t('dialogs.assetLibrary.loadFailed'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        if (open) {
            loadAssets();
            setSelectedAsset(null);
            setSearchTerm('');
        }
    }, [open, loadAssets]);

    // Update editingName when selection changes
    useEffect(() => {
        if (selectedAsset) {
            setEditingName(selectedAsset.name);
        }
    }, [selectedAsset]);

    const filteredAssets = useMemo(() => {
        if (!searchTerm.trim()) return assets;
        const term = searchTerm.toLowerCase();
        return assets.filter(a =>
            a.name.toLowerCase().includes(term) ||
            a.mediaType.toLowerCase().includes(term)
        );
    }, [assets, searchTerm]);

    const referencingNodes = useMemo(() => {
        if (!selectedAsset) return [];
        return nodes.filter(n => {
            const nodeAssetId = resolveNodeAssetId(n);
            if (nodeAssetId === selectedAsset.id) return true;
            if (nodeAssetId && storeAssets[nodeAssetId]) {
                const nodeAsset = storeAssets[nodeAssetId] as any;
                if (Array.isArray(nodeAsset.value)) {
                    return nodeAsset.value.some((item: any) => item?.mediaAssetId === selectedAsset.id);
                }
            }
            return false;
        });
    }, [selectedAsset, nodes, storeAssets]);

    // --- Helpers ---

    const getUrl = (asset: MediaAssetInfo) => {
        const path = asset.content || asset.thumbnailPath;
        if (!path) return null;
        if (path.startsWith('http') || path.startsWith('data:')) return path;
        if (serverPort && (path.startsWith('assets/') || path.includes('assets\\\\'))) {
            const filename = path.replace(/\\/g, '/').split('/').pop();
            return `http://localhost:${serverPort}/assets/${filename}`;
        }
        return null;
    };

    const handleLocateNode = (nodeId: string) => {
        onOpenChange(false);
        onLocateNode?.(nodeId);
    };

    // --- Actions ---

    const handleDeleteAsset = async () => {
        if (!selectedAsset) return;
        const toastId = toast.loading(t('dialogs.assetLibrary.deleting'));
        try {
            await graphEngine.assets.delete(selectedAsset.id, true);
            toast.success(t('dialogs.assetLibrary.deleted'), { id: toastId });
            setSelectedAsset(null);
            loadAssets();
        } catch (e) {
            console.error('Failed to delete asset:', e);
            toast.error(t('dialogs.assetLibrary.deleteFailed'), { id: toastId });
        }
    };

    const handleCleanupOrphans = async () => {
        const toastId = toast.loading('Cleaning up orphan assets...');
        try {
            const result = await graphEngine.assets.cleanupOrphans();
            if (result.deletedCount > 0) {
                toast.success(`Deleted ${result.deletedCount} orphan assets`, { id: toastId });
            } else {
                toast.info('No orphan assets found', { id: toastId });
            }
            setSelectedAsset(null);
            loadAssets();
        } catch (e) {
            console.error('Failed to cleanup orphan assets:', e);
            toast.error('Cleanup failed', { id: toastId });
        }
    };

    const handleImport = async () => {
        const selected = await openDialog({
            multiple: true,
            filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }]
        });
        if (selected && Array.isArray(selected) && selected.length > 0) {
            const toastId = toast.loading(`Importing ${selected.length} images...`);
            try {
                const results = await apiClient.batchImportImages(selected);
                const succeeded = results.filter(r => r.result).length;
                const failed = results.filter(r => r.error).length;
                if (failed > 0) {
                    toast.warning(`Imported ${succeeded}, failed ${failed}`, { id: toastId });
                } else {
                    toast.success(`Imported ${succeeded} images`, { id: toastId });
                }
                loadAssets();
            } catch (e) {
                console.error('Batch import failed:', e);
                toast.error('Import failed', { id: toastId });
            }
        }
    };

    // --- Handlers for Rename ---
    const handleRename = () => {
        if (!selectedAsset || !editingName.trim() || editingName === selectedAsset.name) return;
        // In a real app we would call: graphEngine.assets.rename(selectedAsset.id, editingName)
        // Since we don't have a direct rename on engine yet, we updated sys.name
        try {
            graphEngine.assets.updateSys(selectedAsset.id, { name: editingName });
            toast.success('Asset renamed');
            // Refresh local asset list optimistically
            setAssets(prev => prev.map(a => a.id === selectedAsset.id ? { ...a, name: editingName } : a));
            setSelectedAsset({ ...selectedAsset, name: editingName });
        } catch (e) {
            toast.error('Failed to rename asset');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[90vw] h-[85vh] p-0 flex flex-col gap-0 overflow-hidden bg-background/95 backdrop-blur-xl border-border/40 shadow-2xl rounded-2xl [&>button]:hidden">
                {/* Header with Title and Search */}
                <div className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-border/40 bg-muted/20">
                    <DialogTitle className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Sparkles className="h-4 w-4 text-primary" />
                        </div>
                        {t('dialogs.assetLibrary.title')}
                    </DialogTitle>

                    {/* Central Search Bar */}
                    <div className="flex-1 max-w-xl px-8">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input
                                placeholder={t('dialogs.assetLibrary.search')}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 h-10 w-full bg-muted/40 border-transparent focus:bg-background focus:border-primary/20 transition-all shadow-sm rounded-xl"
                            />
                        </div>
                    </div>

                    {/* Header Actions */}
                    <div className="flex gap-2">
                        <Button variant="default" size="sm" onClick={handleImport} className="shadow-sm rounded-lg h-9">
                            <Upload className="w-4 h-4 mr-2" />
                            {t('dialogs.assetLibrary.import')}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground rounded-lg" onClick={() => onOpenChange(false)}>
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                {/* Main Content Area: Master-Detail Layout */}
                <div className="flex-1 flex min-h-0 bg-muted/10 relative">

                    {/* Left Panel: Asset Grid */}
                    <div className="flex-1 flex flex-col min-w-0">
                        <ScrollArea className="flex-1">
                            <div className="p-6" onClick={() => setSelectedAsset(null)}>
                                {loading ? (
                                    <div className="flex flex-col items-center justify-center h-64 gap-4">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
                                        <p className="text-sm text-muted-foreground animate-pulse">Loading library...</p>
                                    </div>
                                ) : filteredAssets.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
                                        <div className="p-4 bg-muted/50 rounded-full">
                                            <FileImage className="h-10 w-10 opacity-40" />
                                        </div>
                                        <p className="text-sm font-medium">{t('dialogs.assetLibrary.noAssets')}</p>
                                        <Button variant="outline" size="sm" onClick={handleImport} className="mt-2">
                                            Import your first asset
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4 pb-20">
                                        {filteredAssets.map(asset => (
                                            <div
                                                key={asset.id}
                                                onClick={(e) => { e.stopPropagation(); setSelectedAsset(asset); }}
                                                className={cn(
                                                    "group relative aspect-square rounded-xl border border-transparent overflow-hidden cursor-pointer transition-all duration-200",
                                                    selectedAsset?.id === asset.id
                                                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg scale-[1.02] z-10"
                                                        : "hover:scale-[1.02] hover:shadow-md hover:border-border/60 bg-muted/30"
                                                )}
                                            >
                                                {/* Image Layer - use object-contain to prevent cropping */}
                                                <div className="w-full h-full flex items-center justify-center">
                                                    {getUrl(asset) ? (
                                                        <img
                                                            src={getUrl(asset)!}
                                                            alt={asset.name}
                                                            className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                                                            loading="lazy"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Overlay Gradient */}
                                                <div className={cn(
                                                    "absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent transition-opacity duration-200",
                                                    selectedAsset?.id === asset.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                                )} />

                                                {/* Asset Info Overlay */}
                                                <div className={cn(
                                                    "absolute bottom-0 left-0 right-0 p-3 pt-6 transition-all duration-200",
                                                    selectedAsset?.id === asset.id ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0"
                                                )}>
                                                    <p className="text-xs font-medium text-white truncate drop-shadow-md">
                                                        {asset.name}
                                                    </p>
                                                    <div className="flex items-center justify-between text-[10px] text-white/70 mt-0.5">
                                                        <span className="uppercase tracking-wider">{asset.mediaType.split('/')[1] || 'FILE'}</span>
                                                        {asset.width && <span>{asset.width}×{asset.height}</span>}
                                                    </div>
                                                </div>

                                                {/* Selection Indicator (Checkmark) */}
                                                {selectedAsset?.id === asset.id && (
                                                    <div className="absolute top-2 right-2 h-5 w-5 bg-primary rounded-full flex items-center justify-center shadow-md border border-white/20">
                                                        <div className="w-2 h-2 bg-primary-foreground rounded-full" />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </ScrollArea>

                        {/* Footer Stats & Global Actions */}
                        <div className="h-12 border-t px-6 flex items-center justify-between text-xs text-muted-foreground bg-background/50 backdrop-blur-sm z-10 absolute bottom-0 left-0 right-0">
                            <div className="flex items-center gap-4">
                                <span className="font-medium">{filteredAssets.length} assets</span>
                                <div className="h-4 w-px bg-border" />
                                <div className="flex items-center gap-1 hover:text-foreground cursor-pointer transition-colors" onClick={handleCleanupOrphans}>
                                    <Trash2 className="w-3 h-3" />
                                    <span>Clean Orphans</span>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={loadAssets} className="h-7 px-2">Refesh Library</Button>
                        </div>
                    </div>

                    {/* Right Panel: Inspector */}
                    <AnimatePresence>
                        {selectedAsset && (
                            <motion.div
                                initial={{ x: "100%", opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: "100%", opacity: 0 }}
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                className="absolute right-0 top-0 bottom-0 h-full w-[380px] border-l border-border/40 bg-background/80 backdrop-blur-xl flex flex-col shadow-2xl z-20"
                            >
                                <div className="flex-1 overflow-hidden flex flex-col w-full">
                                    <ScrollArea className="flex-1 w-full">
                                        <div className="p-6 space-y-6">
                                            {/* Large Preview */}
                                            <div className="space-y-3">
                                                <div className="aspect-video bg-muted/40 rounded-xl overflow-hidden border shadow-sm relative group flex items-center justify-center">
                                                    {getUrl(selectedAsset) ? (
                                                        <img
                                                            src={getUrl(selectedAsset)!}
                                                            alt={selectedAsset.name}
                                                            className="max-w-full max-h-full object-contain"
                                                        />
                                                    ) : (
                                                        <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
                                                    )}
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                        <Button size="icon" variant="secondary" className="rounded-full shadow-lg">
                                                            <Maximize2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Metadata Form */}
                                            <div className="space-y-4">
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</Label>
                                                    <Input
                                                        value={editingName}
                                                        onChange={(e) => setEditingName(e.target.value)}
                                                        onBlur={handleRename}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                                                        className="font-medium"
                                                    />
                                                </div>

                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
                                                        <Label className="text-[10px] text-muted-foreground uppercase font-bold">Type</Label>
                                                        <p className="text-sm font-medium mt-0.5 truncate" title={selectedAsset.mediaType}>{selectedAsset.mediaType}</p>
                                                    </div>
                                                    <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
                                                        <Label className="text-[10px] text-muted-foreground uppercase font-bold">Size</Label>
                                                        <p className="text-sm font-medium mt-0.5">
                                                            {selectedAsset.width ? `${selectedAsset.width}×${selectedAsset.height}` : 'N/A'}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
                                                    <Label className="text-[10px] text-muted-foreground uppercase font-bold">Added</Label>
                                                    <p className="text-sm font-medium mt-0.5">{new Date(selectedAsset.createdAt || selectedAsset.updatedAt).toLocaleString()}</p>
                                                </div>
                                            </div>

                                            <Separator />

                                            {/* References Section */}
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                                        <MapPin className="h-3 w-3" />
                                                        Refrences ({referencingNodes.length})
                                                    </Label>
                                                </div>

                                                {referencingNodes.length === 0 ? (
                                                    <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                                                        <p className="text-xs text-green-600 dark:text-green-400 font-medium">Safe to delete</p>
                                                        <p className="text-[10px] text-green-600/70 dark:text-green-400/70">No nodes reference this asset</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {referencingNodes.map(node => (
                                                            <div
                                                                key={node.id}
                                                                className="flex items-center justify-between p-2.5 bg-muted/40 hover:bg-muted/60 rounded-lg border border-transparent hover:border-border transition-colors group/item"
                                                            >
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="text-xs font-medium truncate">{node.data?.title || node.type}</span>
                                                                    <span className="text-[10px] text-muted-foreground truncate font-mono">ID: {node.id.slice(0, 8)}...</span>
                                                                </div>
                                                                <Button
                                                                    size="sm"
                                                                    variant="secondary"
                                                                    className="h-6 px-2 text-[10px] opacity-0 group-hover/item:opacity-100 transition-opacity"
                                                                    onClick={() => handleLocateNode(node.id)}
                                                                >
                                                                    Locate
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <AssetJsonViewer asset={selectedAsset} />
                                        </div>
                                    </ScrollArea>

                                    {/* Inspector Actions */}
                                    <div className="p-4 border-t bg-muted/20 backdrop-blur-md flex items-center justify-end gap-3 z-10">
                                        <Button variant="ghost" onClick={() => setSelectedAsset(null)}>
                                            Close
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    variant={referencingNodes.length > 0 ? "outline" : "destructive"}
                                                    disabled={referencingNodes.length > 0}
                                                    className="shadow-sm"
                                                >
                                                    <Trash2 className="h-4 w-4 mr-1.5" />
                                                    Delete
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Delete this asset?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will permanently delete "{selectedAsset.name}" from your library and disk.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={handleDeleteAsset} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                        Delete Permanently
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </DialogContent>
        </Dialog>
    );
};
