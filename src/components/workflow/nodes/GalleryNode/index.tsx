import { memo, useEffect, useState, useMemo } from 'react';
import { NodeProps, NodeResizer, useUpdateNodeInternals } from '@xyflow/react';
import { SynniaNode, NodeType } from '@/types/project';
import { NodeShell } from '../primitives/NodeShell';
import { NodeHeader, NodeHeaderAction } from '../primitives/NodeHeader';
import { NodePort } from '../primitives/NodePort';
import { useNode } from '@/hooks/useNode';
import { useWorkflowStore } from '@/store/workflowStore';
import { Image as ImageIcon, Trash2, ChevronDown, ChevronUp, Star } from 'lucide-react';
import { StandardAssetBehavior } from '@/lib/behaviors/StandardBehavior';
import { Inspector } from './Inspector';
import { cn } from '@/lib/utils';
import type { NodeDefinition } from '@/lib/nodes/NodeRegistry';

// --- Asset Content Type ---
export interface GalleryImage {
    id: string;
    src: string;
    starred: boolean;
    caption?: string;
    mediaAssetId?: string; // Reference to source asset in library
}

export interface GalleryAssetContent {
    viewMode: 'grid' | 'list' | 'single';
    columnsPerRow: number;
    allowStar: boolean;
    allowDelete: boolean;
    images: GalleryImage[];
}

// --- Node Component ---
export const GalleryNode = memo((props: NodeProps<SynniaNode>) => {
    const { id, selected } = props;
    const { state, actions } = useNode(id);
    const serverPort = useWorkflowStore(s => s.serverPort);
    const updateNodeInternals = useUpdateNodeInternals();

    useEffect(() => {
        updateNodeInternals(id);
    }, [state.isCollapsed, id, updateNodeInternals]);

    // Get content with defaults - now using asset.value for GalleryAssetContent
    const content: GalleryAssetContent = useMemo(() => {
        const raw = (state.asset?.value as GalleryAssetContent) || {};
        return {
            viewMode: raw.viewMode ?? 'grid',
            columnsPerRow: raw.columnsPerRow ?? 4,
            allowStar: raw.allowStar ?? true,
            allowDelete: raw.allowDelete ?? true,
            images: raw.images ?? [],
        };
    }, [state.asset?.value]);

    // Resolve image URLs
    const resolveUrl = (src: string): string => {
        if (!src) return '';
        if ((src.startsWith('assets/') || src.startsWith('assets\\')) && serverPort) {
            const filename = src.replace(/\\/g, '/').split('/').pop();
            return `http://localhost:${serverPort}/assets/${filename}`;
        }
        return src;
    };

    // Toggle star
    const toggleStar = (imageId: string) => {
        if (state.isReference) return;
        actions.updateContent({
            ...content,
            images: content.images.map(img =>
                img.id === imageId ? { ...img, starred: !img.starred } : img
            )
        });
    };

    // Delete image
    const deleteImage = (imageId: string) => {
        if (state.isReference) return;
        actions.updateContent({
            ...content,
            images: content.images.filter(img => img.id !== imageId)
        });
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
                                        <img
                                            src={resolveUrl(img.src)}
                                            alt={img.caption || 'Gallery image'}
                                            className={cn(
                                                'object-cover',
                                                content.viewMode === 'grid' && 'w-full h-full',
                                                content.viewMode === 'list' && 'h-full w-14',
                                                content.viewMode === 'single' && 'max-w-full max-h-full object-contain'
                                            )}
                                        />

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

// --- Node Definition (unified registration) ---
export const definition: NodeDefinition = {
    type: NodeType.GALLERY,
    component: GalleryNode,
    inspector: Inspector,
    config: {
        type: NodeType.GALLERY,
        title: 'Gallery',
        category: 'Asset',
        icon: ImageIcon,
        description: 'Image gallery with preview',

        requiresAsset: true,
        defaultAssetType: 'json',
        createNodeAlias: 'gallery',

        defaultStyle: { width: 320, height: 280 },

        createDefaultAsset: () => ({
            valueType: 'record' as const,
            value: {
                viewMode: 'grid',
                columnsPerRow: 4,
                allowStar: true,
                allowDelete: true,
                images: []
            } as GalleryAssetContent,
        }),
    },
    behavior: StandardAssetBehavior,
    ports: {
        static: [
            {
                id: 'output',
                direction: 'output',
                dataType: 'array',
                label: 'Gallery Images',
                resolver: (node, asset) => {
                    if (!asset?.value) return null;
                    const content = asset.value as GalleryAssetContent;
                    return {
                        type: 'array',
                        value: content.images,
                        meta: { nodeId: node.id, portId: 'output' }
                    };
                }
            }
        ]
    },
};

// Legacy exports for compatibility with current node loader
export { GalleryNode as Node, Inspector };
export const config = definition.config;
export const behavior = definition.behavior;
