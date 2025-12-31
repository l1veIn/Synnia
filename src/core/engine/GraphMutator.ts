import { GraphEngine } from './GraphEngine';
import { SynniaNode, NodeType } from '@/types/project';
import { ValueType } from '@/types/assets';
import { nodeRegistry } from '@core/registry/NodeRegistry';
import { v4 as uuidv4 } from 'uuid';
import { sortNodesTopologically, sanitizeNodeForClipboard } from '@core/utils/graph';
import { XYPosition } from '@xyflow/react';
import { getRecipe } from '@features/recipes';
import { OutputConfig } from '@/types/recipe';

// Helper: Map old asset type strings to new ValueType
function toValueType(assetType: string): ValueType {
    switch (assetType) {
        case 'text': return 'text';
        case 'image': return 'image';
        case 'json': return 'record';
        default: return 'record';
    }
}

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
        config: OutputConfig,
        sourceNodeId: string
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
        // Check if it's a virtual recipe type (e.g., "recipe:math.divide")
        const isVirtualRecipe = typeof type === 'string' && type.startsWith('recipe:');

        // Get meta - for virtual recipes, look up by the full type string
        const meta = nodeRegistry.getMeta(type) || nodeRegistry.getMeta(NodeType.FORM);
        const def = nodeRegistry.getDefinition(type);

        // Node type is used directly (no legacy routing needed)
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

            // Merge config from createResult and options
            const config = createResult?.asset?.config || options.assetConfig;

            // Use AssetSystem
            assetId = this.engine.assets.create(valueType, content, {
                name,
                valueMeta: options.valueMeta,
                config
            });
        }

        const nodeTitle = (options as any).title || options.assetName || meta?.title || 'Node';

        // Build node data
        const recipeId = isVirtualRecipe ? type.replace('recipe:', '') : undefined;
        const dockedTo = (options as any).dockedTo;

        const nodeData: any = {
            title: nodeTitle,
            state: 'idle',
            assetId,
            recipeId,
            ...(dockedTo ? { dockedTo } : {}),
        };

        const newNode: SynniaNode = {
            id: uuidv4(),
            type: finalType,
            position,
            data: nodeData,
            style: {
                // Use defaultStyle from node meta
                ...(meta?.style || {}),
                ...(isVirtualRecipe ? { width: 280 } : {}), // Recipe nodes have fixed width
                ...(options.style || {}),
            },
        };

        const { nodes } = this.engine.state;
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

    public detachNode(nodeId: string) {
        // Reuse reparentNode logic which now handles transform
        // VerticalStackBehavior.onChildRemove handles all cleanup (reset flags, styles, resize)
        const node = this.engine.state.nodes.find(n => n.id === nodeId);
        if (!node || !node.parentId) return;

        // 1. Reparent to Root (triggers hooks)
        this.engine.reparentNode(nodeId, undefined);

        // Note: reparentNode automatically triggers fixGlobalLayout and setNodes
    }

    public createShortcut(nodeId: string) {
        const { nodes } = this.engine.state;
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;

        // Only nodes with create factory or RECIPE can have shortcuts
        const def = nodeRegistry.getDefinition(node.type);
        const canShortcut = def?.create !== undefined || node.type === NodeType.RECIPE;
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
