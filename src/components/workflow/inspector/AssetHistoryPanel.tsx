/**
 * Asset History Panel
 * 
 * Displays version history for an asset and allows restoring previous versions.
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient, AssetHistoryEntry } from '@/lib/apiClient';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { History, RotateCcw, Clock, Hash, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { graphEngine } from '@/lib/engine/GraphEngine';

interface AssetHistoryPanelProps {
    assetId?: string;
    nodeId?: string;
}

export const AssetHistoryPanel = ({ assetId, nodeId }: AssetHistoryPanelProps) => {
    const [history, setHistory] = useState<AssetHistoryEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [restoring, setRestoring] = useState<number | null>(null);
    const [selectedId, setSelectedId] = useState<number | null>(null);

    // Load history on mount or asset change
    const loadHistory = useCallback(async () => {
        if (!assetId) return;

        setLoading(true);
        try {
            const entries = await apiClient.getAssetHistory(assetId, 50);
            setHistory(entries);
        } catch (e) {
            console.error('Failed to load history:', e);
            toast.error('Failed to load version history');
        } finally {
            setLoading(false);
        }
    }, [assetId]);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    // Restore a version
    const handleRestore = async (entry: AssetHistoryEntry) => {
        if (!assetId) return;

        setRestoring(entry.id);
        try {
            const restoredContent = await apiClient.restoreAssetVersion(assetId, entry.id);

            // Update local store
            graphEngine.assets.update(assetId, restoredContent);

            toast.success('Version restored successfully');

            // Reload history
            await loadHistory();
        } catch (e) {
            console.error('Failed to restore version:', e);
            toast.error('Failed to restore version');
        } finally {
            setRestoring(null);
        }
    };

    // Format timestamp
    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - timestamp;

        // Less than 1 minute
        if (diff < 60000) return 'Just now';
        // Less than 1 hour
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        // Less than 24 hours
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        // Same year
        if (date.getFullYear() === now.getFullYear()) {
            return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        }
        // Different year
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    };

    if (!assetId) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                <History className="h-8 w-8 mb-3 opacity-50" />
                <p className="text-xs text-center">No asset selected</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mb-2" />
                <p className="text-xs">Loading history...</p>
            </div>
        );
    }

    if (history.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                <History className="h-8 w-8 mb-3 opacity-50" />
                <p className="text-xs text-center">No version history yet</p>
                <p className="text-[10px] text-center mt-1 opacity-70">
                    Save changes to create history entries
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-4 py-3 border-b bg-muted/10 shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Version History</span>
                    </div>
                    <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full">
                        {history.length} versions
                    </span>
                </div>
            </div>

            {/* History List */}
            <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                    {history.map((entry, index) => (
                        <div
                            key={entry.id}
                            className={cn(
                                "group p-3 rounded-lg border cursor-pointer transition-all",
                                selectedId === entry.id
                                    ? "bg-primary/10 border-primary/30"
                                    : "bg-card hover:bg-muted/50 border-transparent hover:border-border"
                            )}
                            onClick={() => setSelectedId(selectedId === entry.id ? null : entry.id)}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    {/* Time */}
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        <span>{formatTime(entry.createdAt)}</span>
                                        {index === 0 && (
                                            <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                                                Current
                                            </span>
                                        )}
                                    </div>

                                    {/* Hash */}
                                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground/70 font-mono">
                                        <Hash className="h-2.5 w-2.5" />
                                        <span>{entry.contentHash.slice(0, 8)}</span>
                                    </div>

                                    {/* Preview */}
                                    {selectedId === entry.id && (
                                        <div className="mt-2 p-2 bg-muted/50 rounded text-[10px] font-mono overflow-hidden">
                                            <pre className="whitespace-pre-wrap break-all max-h-20 overflow-hidden">
                                                {entry.contentPreview}
                                            </pre>
                                        </div>
                                    )}
                                </div>

                                {/* Restore Button */}
                                {index !== 0 && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className={cn(
                                            "h-7 w-7 p-0 shrink-0",
                                            "opacity-0 group-hover:opacity-100 transition-opacity",
                                            selectedId === entry.id && "opacity-100"
                                        )}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRestore(entry);
                                        }}
                                        disabled={restoring !== null}
                                    >
                                        {restoring === entry.id ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <RotateCcw className="h-3.5 w-3.5" />
                                        )}
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>

            {/* Footer */}
            <div className="px-4 py-2 border-t bg-muted/10 shrink-0">
                <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                    <span>Asset: {assetId.slice(0, 8)}...</span>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[10px] px-2"
                        onClick={loadHistory}
                    >
                        Refresh
                    </Button>
                </div>
            </div>
        </div>
    );
};
