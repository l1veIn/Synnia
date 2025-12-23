import { List } from 'lucide-react';
import { NodeType } from '@/types/project';
import { StandardAssetBehavior } from '@core/registry/StandardBehavior';
import type { NodeDefinition, CreateContext } from '@core/registry/NodeRegistry';
import { SelectorNode } from './index';
import { DEFAULT_OPTION_SCHEMA } from './types';
import { Inspector } from './Inspector';

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
                optionSchema: schemaFields,
                selected: [] as string[],
            },
            asset: {
                valueType: 'array' as const,
                value: items.map((item: any, i: number) => ({
                    id: item.id || `opt-${i}`,
                    ...item,
                })),
                config: { mode: 'multi' as const },
            },
        };
    },
    hooks: {
        getItems: (asset) => {
            const val = asset.value;
            if (Array.isArray(val)) return val;
            if (val && typeof val === 'object' && 'options' in val) return (val as any).options || [];
            return [];
        },
        mergeItems: (existing, incoming) => [...existing, ...incoming],
    },
    behavior: StandardAssetBehavior,
    ports: {
        static: [
            {
                id: 'output',
                direction: 'output',
                dataType: 'array',
                label: 'Selected Items',
                resolver: (node, asset) => {
                    if (!asset?.value) return null;
                    const items = Array.isArray(asset.value) ? asset.value : [];
                    const selected = (node.data as any)?.selected || [];
                    const selectedOptions = items.filter((opt: any) => selected.includes(opt.id));
                    return {
                        type: 'array',
                        value: selectedOptions,
                        meta: { nodeId: node.id, portId: 'output' }
                    };
                }
            }
        ]
    },
};
