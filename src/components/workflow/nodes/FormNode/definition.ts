import { Braces } from 'lucide-react';
import { NodeType } from '@/types/project';
import { FieldDefinition, RecordAsset, isRecordAsset } from '@/types/assets';
import { StandardAssetBehavior } from '@/lib/behaviors/StandardBehavior';
import type { NodeDefinition, CreateContext } from '@/lib/nodes/NodeRegistry';
import { useWorkflowStore } from '@/store/workflowStore';
import { FormNode } from './index';
import { FormNodeInspector } from './Inspector';

export const definition: NodeDefinition = {
    type: NodeType.FORM,
    component: FormNode,
    inspector: FormNodeInspector,
    meta: {
        title: 'Form',
        icon: Braces,
        category: 'Asset',
        description: 'Form data with custom schema',
        alias: 'form',
        style: { width: 250, height: 200, minWidth: 200 },
    },
    capabilities: {
        collapsible: true,
        dockable: true,
    },
    create: ({ data, schema }: CreateContext) => ({
        asset: {
            valueType: 'record' as const,
            value: data || {},  // Form values directly in asset.value
            valueMeta: {},
            config: { schema: schema || [] },  // Schema in config
        } as Partial<RecordAsset>,
    }),
    hooks: {
        canDockWith: ({ asset }, _target, targetAsset) => {
            // Schema is now in asset.config.schema for RecordAsset
            const schemaA = (asset && isRecordAsset(asset)) ? asset.config?.schema || [] : [];
            const schemaB = (targetAsset && isRecordAsset(targetAsset)) ? targetAsset.config?.schema || [] : [];
            if (schemaA.length !== schemaB.length) return false;
            const keysA = schemaA.map((f: FieldDefinition) => f.key).sort();
            const keysB = schemaB.map((f: FieldDefinition) => f.key).sort();
            return JSON.stringify(keysA) === JSON.stringify(keysB);
        },
    },
    behavior: StandardAssetBehavior,
    ports: {
        static: [
            {
                id: 'output',
                direction: 'output',
                dataType: 'json',
                label: 'JSON Output',
                resolver: (node, asset) => {
                    if (!asset) return null;
                    // Values are now directly in asset.value for RecordAsset
                    return {
                        type: 'json',
                        value: asset.value || {},
                        meta: { nodeId: node.id, portId: 'output' }
                    };
                }
            },
            {
                id: 'array',
                direction: 'output',
                dataType: 'array',
                label: 'Array Output',
                semantic: true,
                resolver: (node, asset) => {
                    const store = useWorkflowStore.getState();
                    const chain: any[] = [];

                    let currentId: string | null = node.id;
                    while (currentId) {
                        const currentNode = store.nodes.find(n => n.id === currentId);
                        if (!currentNode) break;

                        const nodeAsset = currentNode.data.assetId
                            ? store.assets[currentNode.data.assetId]
                            : undefined;

                        if (nodeAsset && nodeAsset.value) {
                            // Values are now directly in asset.value
                            chain.unshift(nodeAsset.value);
                        }

                        currentId = currentNode.data.dockedTo as string | null;
                    }

                    return {
                        type: 'array',
                        value: chain,
                        meta: { nodeId: node.id, portId: 'array' }
                    };
                }
            }
        ]
    },
};
