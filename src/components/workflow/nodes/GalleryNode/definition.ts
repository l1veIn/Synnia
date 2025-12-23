import { Image as ImageIcon } from 'lucide-react';
import { NodeType } from '@/types/project';
import { StandardAssetBehavior } from '@core/registry/StandardBehavior';
import type { NodeDefinition, CreateContext } from '@core/registry/NodeRegistry';
import { GalleryNode } from './index';
import { Inspector } from './Inspector';

export const definition: NodeDefinition = {
    type: NodeType.GALLERY,
    component: GalleryNode,
    inspector: Inspector,
    meta: {
        title: 'Gallery',
        icon: ImageIcon,
        category: 'Asset',
        description: 'Image gallery with preview',
        alias: 'gallery',
        style: { width: 320, height: 280, minWidth: 200 },
    },
    capabilities: {
        collapsible: true,
        isCollection: true,
    },
    create: ({ data }: CreateContext) => {
        const items = Array.isArray(data) ? data : [];
        return {
            data: {
                viewMode: 'grid' as const,
                columnsPerRow: Math.min(4, items.length || 4),
                allowStar: true,
                allowDelete: true,
            },
            asset: {
                valueType: 'array' as const,
                value: items.map((item: any, i: number) => ({
                    id: item.id || `img-${i}`,
                    src: item.src || item.url || '',
                    starred: item.starred ?? false,
                    caption: item.caption || '',
                })),
            },
        };
    },
    hooks: {
        getItems: (asset) => {
            const val = asset.value;
            if (Array.isArray(val)) return val;
            if (val && typeof val === 'object' && 'images' in val) return (val as any).images || [];
            return [];
        },
        mergeItems: (existing, incoming) => [...incoming, ...existing],
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
                    const images = Array.isArray(asset.value) ? asset.value : (asset.value as any).images || [];
                    return {
                        type: 'array',
                        value: images,
                        meta: { nodeId: node.id, portId: 'output' }
                    };
                }
            }
        ]
    },
};
