import { FileText } from 'lucide-react';
import { NodeType } from '@/types/project';
import { StandardAssetBehavior } from '@/lib/behaviors/StandardBehavior';
import type { NodeDefinition, CreateContext } from '@/lib/nodes/NodeRegistry';
import { TextNode } from './index';
import { TextNodeInspector } from './Inspector';

export const definition: NodeDefinition = {
    type: NodeType.TEXT,
    component: TextNode,
    inspector: TextNodeInspector,
    meta: {
        title: 'Text',
        icon: FileText,
        category: 'Asset',
        description: 'Text content',
        alias: 'text',
        style: { width: 250, height: 200, minWidth: 200 },
    },
    capabilities: {
        collapsible: true,
    },
    create: ({ data }: CreateContext) => ({
        asset: { valueType: 'text' as const, value: data || '' },
    }),
    behavior: StandardAssetBehavior,
    ports: {
        static: [
            {
                id: 'output',
                direction: 'output',
                dataType: 'text',
                label: 'Text Output',
                resolver: (node, asset) => ({
                    type: 'text',
                    value: asset?.value || '',
                    meta: { nodeId: node.id, portId: 'output' }
                })
            }
        ]
    },
};
