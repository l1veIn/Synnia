import { ImageIcon } from 'lucide-react';
import { NodeType } from '@/types/project';
import { isImageAsset } from '@/types/assets';
import type { NodeDefinition, CreateContext } from '@core/registry/NodeRegistry';
import { ImageNode } from './index';
import { Inspector } from './Inspector';
import { ImageBehavior } from './behavior';

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
    behavior: ImageBehavior,
    ports: {
        static: [
            {
                id: 'output',
                direction: 'output',
                dataType: 'json',  // image is json with url field
                label: 'Image Output',
            }
        ]
    },
};
