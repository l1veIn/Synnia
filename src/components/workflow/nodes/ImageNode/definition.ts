import { ImageIcon } from 'lucide-react';
import { NodeType } from '@/types/project';
import { StandardAssetBehavior } from '@core/registry/StandardBehavior';
import { isImageAsset } from '@/types/assets';
import type { NodeDefinition, CreateContext } from '@core/registry/NodeRegistry';
import { ImageNode } from './index';
import { Inspector } from './Inspector';

export const definition: NodeDefinition = {
    type: NodeType.IMAGE,
    component: ImageNode,
    inspector: Inspector,
    meta: {
        title: 'Image',
        icon: ImageIcon,
        category: 'Asset',
        description: 'Import image from file',
        alias: 'image',
        style: { width: 300, height: 300, minWidth: 200 },
        fileImport: { accept: 'image/*', assetType: 'image' },
    },
    capabilities: {
        collapsible: true,
    },
    create: ({ data }: CreateContext) => ({
        asset: { valueType: 'image' as const, value: data || '' },
    }),
    behavior: StandardAssetBehavior,
    ports: {
        static: [
            {
                id: 'output',
                direction: 'output',
                dataType: 'image',
                label: 'Image Output',
                resolver: (node, asset) => {
                    if (!asset || !isImageAsset(asset)) return null;
                    const meta = asset.valueMeta || {};
                    const url = typeof asset.value === 'string' ? asset.value : '';
                    return {
                        type: 'image',
                        value: { url, width: meta.width, height: meta.height, mimeType: asset.config?.mimeType },
                        meta: { nodeId: node.id, portId: 'output' }
                    };
                }
            }
        ]
    },
};
