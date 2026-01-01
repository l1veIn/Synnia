import { ListTodo } from 'lucide-react';
import { NodeType } from '@/types/project';
import type { NodeDefinition, CreateContext } from '@core/registry/NodeRegistry';
import { QueueNode } from './index';
import { Inspector } from './Inspector';
import { QueueBehavior } from './behavior';

export const definition: NodeDefinition = {
    type: NodeType.QUEUE,
    component: QueueNode,
    inspector: Inspector,
    meta: {
        title: 'Queue',
        icon: ListTodo,
        category: 'Process',
        description: 'Task queue management',
        style: { width: 300, height: 280, minWidth: 220 },
    },
    capabilities: {
        collapsible: true,
        isCollection: true,
    },
    create: ({ data }: CreateContext) => {
        const items = Array.isArray(data) ? data : [];
        return {
            data: {
                concurrency: 1,
                autoStart: false,
                retryOnError: true,
                retryCount: 3,
            },
            asset: {
                valueType: 'array' as const,
                value: items,
            },
        };
    },
    hooks: {
        getItems: (asset) => {
            const val = asset.value;
            if (Array.isArray(val)) return val;
            if (val && typeof val === 'object' && 'tasks' in val) return (val as any).tasks || [];
            return [];
        },
    },
    behavior: QueueBehavior,
    ports: {
        static: [
            {
                id: 'output',
                direction: 'output',
                dataType: 'array',
                label: 'Completed Results',
            }
        ]
    },
};
