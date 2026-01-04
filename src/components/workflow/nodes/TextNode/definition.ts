import { FileText } from 'lucide-react';
import { NodeType } from '@/types/project';
import type { NodeDefinition, CreateContext } from '@core/registry/NodeRegistry';
import { TextNode } from './index';
import { TextNodeInspector } from './Inspector';
import { TextBehavior } from './behavior';
import { TEXT_SCHEMA } from './schema';

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
        asset: {
            valueType: 'record' as const,
            value: { content: data || '', format: 'plain' },
            config: { schema: TEXT_SCHEMA },
        },
    }),
    behavior: TextBehavior,
    ports: {
        static: [
            {
                id: 'output',
                direction: 'output',
                dataType: 'text',
                label: 'Text Output',
            }
        ]
    },
};
