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
                // Only UI state in node.data
                selected: [] as string[],
            },
            asset: {
                valueType: 'array' as const,
                value: items.map((item: any, i: number) => ({
                    id: item.id || `opt-${i}`,
                    ...item,
                })),
                config: {
                    mode: 'multi' as const,
                    optionSchema: schemaFields,  // Schema belongs in asset.config
                },
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

                    // Handle both array format and SelectorAssetContent format
                    let items: any[] = [];
                    let selectedIds: string[] = [];

                    if (Array.isArray(asset.value)) {
                        // Array format: items are in asset.value, selected in node.data
                        items = asset.value;
                        selectedIds = (node.data as any)?.selected || [];
                    } else {
                        // SelectorAssetContent format: options and selected in asset.value
                        const content = asset.value as any;
                        items = content.options || [];
                        selectedIds = content.selected || [];
                    }

                    const selectedOptions = items.filter((opt: any) => selectedIds.includes(opt.id));
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
