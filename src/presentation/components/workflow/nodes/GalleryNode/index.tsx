import { memo, useEffect, useMemo, useState } from 'react';
import { NodeProps, NodeResizer, useUpdateNodeInternals } from '@xyflow/react';
import { SynniaNode } from '@/presentation/types/project';
import { NodeShell } from '../primitives/NodeShell';
import { NodeHeader, NodeHeaderAction } from '../primitives/NodeHeader';
import { NodePort } from '../primitives/NodePort';
import { useNode } from '@/presentation/hooks/useNode';
import { useWorkflowStore } from '@/store/workflowStore';
import { Image as ImageIcon, Trash2, ChevronDown, ChevronUp, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient, MediaAssetInfo } from '@/lib/apiClient';
import { GalleryImageRef, GalleryDisplayConfig } from './types';

// --- Node Component ---
export const GalleryNode = memo((props: NodeProps<SynniaNode>) => {
    const { id, selected } = props;
    const { state, actions } = useNode(id);
    const serverPort = useWorkflowStore(s => s.serverPort);
    const updateNodeInternals = useUpdateNodeInternals();

    // Media assets cache for resolving URLs
    const [mediaAssets, setMediaAssets] = useState<Map<string, MediaAssetInfo>>(new Map());

    useEffect(() => {
        updateNodeInternals(id);
    }, [state.isCollapsed, id, updateNodeInternals]);

    // Load media assets for URL resolution
    useEffect(() => {
        apiClient.getMediaAssets().then(resp => {
            setMediaAssets(new Map(resp.items.map(a => [a.id, a])));
        });
    }, []);

    // Get content with defaults - normalized: value is images[], config.extra has settings
    const content = useMemo(() => {
        const raw = state.asset?.value;
        const config = state.asset?.config as any || {};
        const extra = config.extra || {};

        // value is always the images array (GalleryImageRef[])
        let images: GalleryImageRef[] = [];
        if (Array.isArray(raw)) {
            images = raw.map((item: any, i: number) => ({
                id: item.id || `img-${i}`,
                mediaAssetId: item.mediaAssetId || '',
                starred: item.starred ?? false,
                caption: item.caption || '',
            }));
        }

        // settings from config.extra
        const displayConfig: GalleryDisplayConfig = {
            viewMode: extra.viewMode ?? 'grid',
            columnsPerRow: extra.columnsPerRow ?? 4,
            allowStar: extra.allowStar ?? true,
            allowDelete: extra.allowDelete ?? true,
        };

        return { images, ...displayConfig };
    }, [state.asset?.value, state.asset?.config]);

    // Resolve image URL from mediaAssetId
    const resolveImageUrl = (item: GalleryImageRef): string => {
        const asset = mediaAssets.get(item.mediaAssetId);
        if (!asset) return '';
        const path = asset.content;
        if (!path) return '';
        if (path.startsWith('http') || path.startsWith('data:')) return path;
        if (serverPort && (path.startsWith('assets/') || path.includes('assets\\\\'))) {
            const filename = path.replace(/\\/g, '/').split('/').pop();
            return `http://localhost:${serverPort}/assets/${filename}`;
        }
        return path;
    };

    // Toggle star - only update value (images array)
    const toggleStar = (imageId: string) => {
        if (state.isReference) return;
        const newImages = content.images.map(img =>
            img.id === imageId ? { ...img, starred: !img.starred } : img
        );
        actions.updateContent(newImages);
    };

    // Delete image - only update value (images array)
    const deleteImage = (imageId: string) => {
        if (state.isReference) return;
        const newImages = content.images.filter(img => img.id !== imageId);
        actions.updateContent(newImages);
    };

    const starredCount = content.images.filter(img => img.starred).length;

    return (
        <NodeShell
            selected={selected}
            state={state.executionState as any}
            className={state.shellClassName}
            dockedTop={state.isDockedTop}
            dockedBottom={state.isDockedBottom}
        >
            <NodeResizer
                isVisible={selected && state.isResizable}
                minWidth={200}
                minHeight={150}
                color="#3b82f6"
                handleStyle={{ width: 8, height: 8, borderRadius: 4 }}
                onResizeEnd={(_e, params) => actions.resize(params.width, params.height)}
            />

            {/* Origin Handle - shown when this is a recipe product */}
            <NodePort.Origin show={state.hasProductHandle} />

            <NodeHeader
                className={state.headerClassName}
                icon={<ImageIcon className="h-4 w-4" />}
                title={state.title}
                actions={
                    <>
                        <NodeHeaderAction onClick={actions.toggle} title={state.isCollapsed ? 'Expand' : 'Collapse'}>
                            {state.isCollapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </NodeHeaderAction>
                        <NodeHeaderAction onClick={(e) => { e.stopPropagation(); actions.remove(); }} title="Delete">
                            <Trash2 className="h-4 w-4 hover:text-destructive" />
                        </NodeHeaderAction>
                    </>
                }
            />

            {!state.isCollapsed && (
                <div className="p-2 flex-1 flex flex-col overflow-hidden gap-2">
                    {/* Image Grid */}
                    <div className="flex-1 min-h-0 overflow-y-auto">
                        {content.images.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                                No images. Add in Inspector.
                            </div>
                        ) : (
                            <div
                                className={cn(
                                    'gap-1',
                                    content.viewMode === 'grid' && 'grid',
                                    content.viewMode === 'list' && 'flex flex-col',
                                    content.viewMode === 'single' && 'flex items-center justify-center'
                                )}
                                style={{
                                    gridTemplateColumns: content.viewMode === 'grid'
                                        ? `repeat(${content.columnsPerRow}, 1fr)`
                                        : undefined
                                }}
                            >
                                {content.images.map((img) => (
                                    <div
                                        key={img.id}
                                        className={cn(
                                            'relative group rounded overflow-hidden bg-muted',
                                            content.viewMode === 'grid' && 'aspect-square',
                                            content.viewMode === 'list' && 'h-16 flex items-center gap-2 p-1',
                                            content.viewMode === 'single' && 'max-w-full max-h-full'
                                        )}
                                    >
                                        {resolveImageUrl(img) ? (
                                            <img
                                                src={resolveImageUrl(img)}
                                                alt={img.caption || 'Gallery image'}
                                                className={cn(
                                                    'object-cover',
                                                    content.viewMode === 'grid' && 'w-full h-full',
                                                    content.viewMode === 'list' && 'h-full w-14',
                                                    content.viewMode === 'single' && 'max-w-full max-h-full object-contain'
                                                )}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-xs">
                                                Loading...
                                            </div>
                                        )}

                                        {/* Star overlay */}
                                        {content.allowStar && (
                                            <button
                                                className={cn(
                                                    'absolute top-1 right-1 p-0.5 rounded transition-all',
                                                    img.starred
                                                        ? 'text-yellow-400 opacity-100'
                                                        : 'text-white opacity-0 group-hover:opacity-70'
                                                )}
                                                onClick={(e) => { e.stopPropagation(); toggleStar(img.id); }}
                                            >
                                                <Star className={cn('h-3.5 w-3.5', img.starred && 'fill-current')} />
                                            </button>
                                        )}

                                        {/* Delete overlay */}
                                        {content.allowDelete && (
                                            <button
                                                className="absolute top-1 left-1 p-0.5 rounded text-white opacity-0 group-hover:opacity-70 hover:text-red-400 transition-all"
                                                onClick={(e) => { e.stopPropagation(); deleteImage(img.id); }}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        )}

                                        {/* Caption for list view */}
                                        {content.viewMode === 'list' && img.caption && (
                                            <span className="text-xs truncate">{img.caption}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground shrink-0 pt-1 border-t">
                        <span>{content.images.length} images{starredCount > 0 && ` • ${starredCount} ⭐`}</span>
                    </div>
                </div>
            )}

            {/* Collapsed preview */}
            {state.isCollapsed && content.images.length > 0 && (
                <div className="px-3 pb-2 text-xs text-muted-foreground">
                    {content.images.length} images{starredCount > 0 && ` • ${starredCount} ⭐`}
                </div>
            )}

            <NodePort.Output disabled={state.isDockedBottom} />
        </NodeShell>
    );
});
GalleryNode.displayName = 'GalleryNode';

// Re-export from separate files
export { Inspector } from './Inspector';
export { definition } from './definition';
export { GalleryNode as Node };
