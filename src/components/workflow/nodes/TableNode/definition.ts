import { Table as TableIcon } from 'lucide-react';
import { NodeType } from '@/types/project';
import { FieldDefinition } from '@/types/assets';
import type { NodeDefinition, CreateContext } from '@core/registry/NodeRegistry';
import { TableNode } from './index';
import { Inspector } from './Inspector';
import { TableBehavior } from './behavior';

export const definition: NodeDefinition = {
    type: NodeType.TABLE,
    component: TableNode,
    inspector: Inspector,
    meta: {
        title: 'Table',
        icon: TableIcon,
        category: 'Asset',
        description: 'Editable data table',
        alias: 'table',
        style: { width: 360, height: 250, minWidth: 250 },
    },
    capabilities: {
        collapsible: true,
        isCollection: true,
    },
    create: ({ data, schema }: CreateContext) => {
        const items = Array.isArray(data) ? data : [];
        const schemaFields = schema || [];
        return {
            asset: {
                valueType: 'array' as const,
                // value: pure data array (rows)
                value: items,
                // config: schema + node-specific settings in extra
                config: {
                    schema: schemaFields,
                    extra: {
                        showRowNumbers: true,
                        allowAddRow: true,
                        allowDeleteRow: true,
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
    behavior: TableBehavior,
    ports: {
        static: [
            {
                id: 'output',
                direction: 'output',
                dataType: 'array',
                label: 'Table Rows',
                // resolver now handled by TableBehavior.resolveOutput
            }
        ]
    },
};
