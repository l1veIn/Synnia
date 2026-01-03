import { GraphEngine } from './GraphEngine';
import { SynniaNode, NodeType } from '@/types/project';
import { ValueType } from '@/types/assets';
import { nodeRegistry } from '@core/registry/NodeRegistry';
import { v4 as uuidv4 } from 'uuid';
import { sortNodesTopologically, sanitizeNodeForClipboard } from '@core/utils/graph';
import { XYPosition } from '@xyflow/react';
import { OutputConfig } from '@/types/recipe';

// NOTE: Node-specific logic (default content, build from data, etc.)
// is defined in each node's config via factory methods.
// See: src/lib/engine/引擎设计原则.md


export class GraphMutator {
    private engine: GraphEngine;

    constructor(engine: GraphEngine) {
        this.engine = engine;
    }

    /**
     * Build node specs from data using the node's create factory
     * Unified approach: delegates to NodeDefinition.create()
     */
    public buildNodesFromConfig(
        data: any,
        config: OutputConfig
    ): {
        type: NodeType | string;
        data: any;
        position?: 'below' | 'right' | XYPosition;
        dockedTo?: string | '$prev';
        assetConfig?: Record<string, any>;  // Universal Output Adapter: passed to asset.config
    }[] {
        if (!Array.isArray(data) || data.length === 0) {
            return [];
        }

        const nodeTypeStr = String(config.node || 'form');

        // Resolve node type (handle aliases)
        const def = nodeRegistry.get(nodeTypeStr) || nodeRegistry.getByAlias(nodeTypeStr);
        if (!def) {
            console.warn(`[buildNodesFromConfig] Unknown node type: ${nodeTypeStr}`);
            return [];
        }

        // Get schema from config.config (Universal Output Adapter pattern)
        const nodeConfig = config.config || {};
        const schema = nodeConfig.schema;

        // Prepare title template resolver
        const resolveTitle = (count: number): string => {
            if (config.title) {
                return config.title.replace(/\{\{count\}\}/g, String(count));
            }
            return `${def.meta.title} (${count})`;
        };

        // For collection nodes (Gallery, Table, Selector, Queue): create single node with all data
        if (def.capabilities?.isCollection) {
            const createResult = def.create({ data, schema });
            return [{
                type: def.type,
                data: {
                    title: resolveTitle(data.length),
                    collapsed: config.collapsed ?? false,
                    ...createResult.data,
                    content: createResult.asset?.value,
                    assetType: 'json' as const,
                },
                // Pass all node config transparently to asset.config
                assetConfig: nodeConfig,
                position: 'below' as const,
            }];
        }

        // For non-collection nodes (Form): create one node per data item (docked chain)
        return data.map((item: any, index: number) => {
            const createResult = def.create({ data: item, schema });

            // Resolve title with item fields
            const title = config.title
                ? config.title
                    .replace(/\{\{index\}\}/g, String(index + 1))
                    .replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => item[k] ?? '')
                : `#${index + 1}`;

            return {
                type: def.type,
                data: {
                    title,
                    collapsed: config.collapsed ?? true,
                    ...createResult.data,
                    content: createResult.asset?.value,
                    assetType: 'json' as const,
                },
                // Pass all node config transparently to asset.config
                assetConfig: nodeConfig,
                position: index === 0 ? 'below' as const : undefined,
                dockedTo: index > 0 ? '$prev' as const : undefined,
            };
        });
    }



    public addNode(type: NodeType | string, position: XYPosition, options: {
        valueType?: ValueType,
        content?: any,
        assetId?: string,
        assetName?: string,
        valueMeta?: any,
        style?: any,
        assetConfig?: Record<string, any>  // Universal Output Adapter: passed to asset.config
    } = {}) {
        // Get meta and definition from registry
        const meta = nodeRegistry.getMeta(type) || nodeRegistry.getMeta(NodeType.FORM);
        const def = nodeRegistry.getDefinition(type);

        // Node type is used directly
        const finalType: string = type as string;

        // Asset creation logic - use node's create factory
        let assetId = options.assetId;

        const hasCreate = def?.create !== undefined;
        if (hasCreate && !assetId) {
            const createResult = def!.create({});
            const valueType: ValueType = (createResult?.asset?.valueType as ValueType) || 'record';
            let content = options.content;
            const name = options.assetName || meta?.title || 'Node';

            // Use default content from create result
            if (!content && createResult?.asset?.value !== undefined) {
                content = createResult.asset.value;
            }
            if (!content) {
                content = ''; // Fallback
            }

            // Merge config from createResult and options.assetConfig
            // options.assetConfig takes precedence (from recipe output config)
            const config = {
                ...(createResult?.asset?.config || {}),
                ...(options.assetConfig || {})
            };

            // Use AssetSystem
            assetId = this.engine.assets.create(valueType, content, {
                name,
                valueMeta: options.valueMeta,
                config
            });
        }

        const nodeTitle = (options as any).title || options.assetName || meta?.title || 'Node';

        // Build node data
        const dockedTo = (options as any).dockedTo;

        const nodeData: any = {
            title: nodeTitle,
            state: 'idle',
            assetId,
            ...(dockedTo ? { dockedTo } : {}),
        };

        const newNode: SynniaNode = {
            id: uuidv4(),
            type: finalType,
            position,
            data: nodeData,
            style: {
                // Use style from node meta
                ...(meta?.style || {}),
                ...(options.style || {}),
            },
        };

        const { nodes } = this.engine.state;
        const newNodes = [...nodes, newNode];
        this.engine.setNodes(sortNodesTopologically(newNodes));

        return newNode.id;
    }

    /**
     * Create a node from a schema definition.
     * Used by form-input/table-input widgets to create matching nodes.
     */
    public createNodeFromSchema(
        nodeType: 'form' | 'table' | 'selector',
        schema: import('@/types/assets').FieldDefinition[],
        options?: {
            title?: string;
            sourceNodeId?: string;  // Position below this node
        }
    ): string {
        const { nodes } = this.engine.state;

        // Calculate position
        let position: XYPosition = { x: 100, y: 100 };
        if (options?.sourceNodeId) {
            const sourceNode = nodes.find(n => n.id === options.sourceNodeId);
            if (sourceNode) {
                position = {
                    x: sourceNode.position.x,
                    y: sourceNode.position.y + (sourceNode.measured?.height || 200) + 50,
                };
            }
        }

        // Resolve node type alias
        const def = nodeRegistry.get(nodeType) || nodeRegistry.getByAlias(nodeType);
        if (!def) {
            console.warn(`[createNodeFromSchema] Unknown node type: ${nodeType}`);
            return '';
        }

        // Use node's create factory with schema
        const createResult = def.create({ schema });
        const title = options?.title || `New ${def.meta.title}`;

        // Create asset with schema in config
        const assetId = this.engine.assets.create(
            createResult?.asset?.valueType || 'record',
            createResult?.asset?.value || {},
            {
                name: title,
                config: {
                    schema,
                    ...(createResult?.asset?.config || {}),
                },
            }
        );

        // Create node
        const newNode: SynniaNode = {
            id: uuidv4(),
            type: def.type,
            position,
            data: {
                title,
                state: 'idle',
                assetId,
                ...(createResult?.data || {}),
            },
            style: def.meta?.style || {},
        };

        const newNodes = [...nodes, newNode];
        this.engine.setNodes(sortNodesTopologically(newNodes));

        return newNode.id;
    }

    public removeNode(id: string) {
        const { nodes } = this.engine.state;

        const nodesToDelete = new Set<string>();
        const queue = [id];

        // Determine all descendants
        while (queue.length > 0) {
            const currentId = queue.pop()!;
            nodesToDelete.add(currentId);

            const children = nodes.filter(n => n.parentId === currentId);
            children.forEach(child => queue.push(child.id));
        }

        // Use Engine Batch Primitive
        this.engine.deleteNodes(Array.from(nodesToDelete));
    }

    public duplicateNode(node: SynniaNode, position?: XYPosition) {
        const { nodes, assets } = this.engine.state;
        const newId = uuidv4();

        const sanitizedNode = sanitizeNodeForClipboard(node);

        let newAssetId = sanitizedNode.data.assetId;
        if (newAssetId && assets[newAssetId]) {
            const originalAsset = assets[newAssetId];
            const valueClone = originalAsset.value ? JSON.parse(JSON.stringify(originalAsset.value)) : originalAsset.value;

            // Use AssetSystem
            newAssetId = this.engine.assets.create(
                originalAsset.valueType,
                valueClone,
                {
                    name: `${originalAsset.sys.name} (Copy)`
                }
            );
        }

        const newNode: SynniaNode = {
            ...sanitizedNode,
            id: newId,
            position: position || { x: node.position.x + 20, y: node.position.y + 20 },
            selected: true,
            parentId: node.parentId,
            extent: node.extent,
            data: {
                ...sanitizedNode.data,
                assetId: newAssetId
            }
        };

        this.engine.deselectAll();

        const finalNodes = sortNodesTopologically([...this.engine.state.nodes, newNode]);
        this.engine.setNodes(finalNodes);
    }

    public createShortcut(nodeId: string) {
        const { nodes } = this.engine.state;
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;

        // Only nodes with create factory can have shortcuts
        const def = nodeRegistry.getDefinition(node.type);
        const canShortcut = def?.create !== undefined;
        if (!canShortcut) return;

        const newId = uuidv4();
        const sanitizedNode = sanitizeNodeForClipboard(node);

        const newNode: SynniaNode = {
            ...sanitizedNode,
            id: newId,
            position: { x: node.position.x + 20, y: node.position.y + 20 },
            selected: true,
            parentId: node.parentId,
            extent: node.extent,
            data: {
                ...sanitizedNode.data,
                isReference: true,
                originalNodeId: node.id
            }
        };

        this.engine.deselectAll();
        const finalNodes = sortNodesTopologically([...this.engine.state.nodes, newNode]);
        this.engine.setNodes(finalNodes);
    }

    public pasteNodes(copiedNodes: SynniaNode[]) {
        const { assets } = this.engine.state;

        const idMap = new Map<string, string>();
        copiedNodes.forEach(n => idMap.set(n.id, uuidv4()));

        const newNodes = copiedNodes.map(node => {
            const newId = idMap.get(node.id)!;

            let newParentId = node.parentId;
            if (node.parentId && idMap.has(node.parentId)) {
                newParentId = idMap.get(node.parentId);
            } else {
                newParentId = undefined;
            }

            const sanitizedNode = sanitizeNodeForClipboard(node);

            let newAssetId = sanitizedNode.data.assetId;
            if (newAssetId) {
                if (assets[newAssetId]) {
                    const originalAsset = assets[newAssetId];
                    const valueClone = originalAsset.value ? JSON.parse(JSON.stringify(originalAsset.value)) : originalAsset.value;

                    // Use AssetSystem
                    newAssetId = this.engine.assets.create(
                        originalAsset.valueType,
                        valueClone,
                        { name: `${originalAsset.sys.name} (Copy)` }
                    );
                } else {
                    newAssetId = this.engine.assets.create(
                        'text',
                        'Content unavailable (Source asset missing)',
                        { name: 'Missing Asset' }
                    );
                }
            }

            return {
                ...sanitizedNode,
                id: newId,
                parentId: newParentId,
                extent: newParentId ? 'parent' : undefined,
                selected: true,
                position: {
                    x: node.position.x + 50,
                    y: node.position.y + 50
                },
                data: {
                    ...sanitizedNode.data,
                    assetId: newAssetId
                }
            } as SynniaNode;
        });

        this.engine.deselectAll();
        const finalNodes = sortNodesTopologically([...this.engine.state.nodes, ...newNodes]);
        this.engine.setNodes(finalNodes);
    }
}
