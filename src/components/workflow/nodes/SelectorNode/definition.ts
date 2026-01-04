import { List } from 'lucide-react';
import { NodeType } from '@/types/project';
import type { NodeDefinition, CreateContext } from '@core/registry/NodeRegistry';
import { SelectorNode } from './index';
import { DEFAULT_OPTION_SCHEMA } from './types';
import { Inspector } from './Inspector';
import { SelectorBehavior } from './behavior';

export const definition: NodeDefinition = {
    type: NodeType.SELECTOR,
    component: SelectorNode,
    inspector: Inspector,
    meta: {
        title: 'Selector',
        icon: List,
        category: 'Asset',
        description: 'Select items from a list',
        alias: 'selector',
        style: { width: 280, height: 300, minWidth: 200 },
    },
    capabilities: {
        collapsible: true,
        isCollection: true,
    },
    create: ({ data, schema }: CreateContext) => {
        const items = Array.isArray(data) ? data : [];
        const schemaFields = schema || DEFAULT_OPTION_SCHEMA;
        return {
            data: {
                // Only UI state in node.data
                selected: [] as string[],
            },
            asset: {
                valueType: 'array' as const,
                // value: pure data array (options)
                value: items.map((item: any, i: number) => ({
                    id: item.id || `opt-${i}`,
                    ...item,
                })),
                // config: schema + node-specific settings in extra
                config: {
                    schema: schemaFields,
                    extra: {
                        mode: 'multi' as const,
                        showSearch: true,
                    },
                },
            },
        };
    },
    hooks: {
        getItems: (asset) => {
            const val = asset.value;
            if (Array.isArray(val)) return val;
            return [];
        },
        mergeItems: (existing, incoming) => [...existing, ...incoming],
    },
    behavior: SelectorBehavior,
    ports: {
        static: [
            {
                id: 'output',
                direction: 'output',
                dataType: 'array',
                label: 'Selected Items',
                // resolver now handled by SelectorBehavior.resolveOutput
            }
        ]
    },
};
