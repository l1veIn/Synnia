import { GraphEngine } from './GraphEngine';
import { SynniaNode, NodeType } from '@/types/project';
import { ValueType } from '@/types/assets';
import { nodesConfig } from '@/components/workflow/nodes';
import { v4 as uuidv4 } from 'uuid';
import { sortNodesTopologically, sanitizeNodeForClipboard } from '@/lib/graphUtils';
import { XYPosition } from '@xyflow/react';
import { getRecipe } from '@/lib/recipes';
import { NodeCreationConfig } from '@/types/recipe';

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
     * Build createNodes array from executor result data and nodeConfig.
     * Uses generic logic based on nodeConfig.type - no node-specific buildFromData.
     * 
     * Supported types:
     * - 'table': Creates TableNode with auto-inferred columns
     * - 'gallery': Creates GalleryNode with image array
     * - 'selector': Creates SelectorNode with options
     * - 'json' (default): Creates JSONNode cards for each item
     */
    public buildNodesFromConfig(
        data: any,
        nodeConfig: NodeCreationConfig,
        sourceNodeId: string
    ): {
        type: NodeType | string;
        data: any;
        position?: 'below' | 'right' | XYPosition;
        dockedTo?: string | '$prev';
    }[] {
        if (!Array.isArray(data) || data.length === 0) {
            return [];
        }

        const nodeTypeStr = String(nodeConfig.type || 'json');

        switch (nodeTypeStr) {
            case 'table': {
                // Auto-infer columns from first row, or use provided schema
                const columns = nodeConfig.schema && nodeConfig.schema !== 'auto'
                    ? nodeConfig.schema.map((f: any) => ({
                        key: f.key,
                        label: f.label || f.key,
                        type: f.type as 'string' | 'number' | 'boolean',
                    }))
                    : Object.keys(data[0] || {}).map(key => ({
                        key,
                        label: key.charAt(0).toUpperCase() + key.slice(1),
                        type: 'string' as const,
                    }));

                const title = nodeConfig.titleTemplate
                    ? nodeConfig.titleTemplate.replace(/\{\{count\}\}/g, String(data.length))
                    : `表格 (${data.length}行)`;

                return [{
                    type: NodeType.TABLE,
                    data: {
                        title,
                        collapsed: nodeConfig.collapsed ?? false,
                        assetType: 'json' as const,
                        content: { columns, rows: data, showRowNumbers: true, allowAddRow: true, allowDeleteRow: true }
                    },
                    position: 'below' as const,
                }];
            }

            case 'gallery': {
                const images = data.map((item: any, idx: number) => ({
                    id: item.id || `img-${idx}`,
                    src: item.src || item.url || '',
                    starred: item.starred ?? false,
                    caption: item.caption || '',
                }));

                const title = nodeConfig.titleTemplate
                    ? nodeConfig.titleTemplate.replace(/\{\{count\}\}/g, String(data.length))
                    : `图库 (${data.length}张)`;

                return [{
                    type: NodeType.GALLERY,
                    data: {
                        title,
                        collapsed: nodeConfig.collapsed ?? false,
                        assetType: 'json' as const,
                        content: {
                            viewMode: 'grid',
                            columnsPerRow: data.length > 2 ? 3 : data.length,
                            allowStar: true,
                            allowDelete: true,
                            images,
                        }
                    },
                    position: 'below' as const,
                    dockedTo: sourceNodeId,
                }];
            }

            case 'selector': {
                const options = data.map((item: any, idx: number) => ({
                    id: item.id || `opt-${idx}`,
                    label: item.label || item.name || item.title || `Option ${idx + 1}`,
                    value: item.value !== undefined ? item.value : item,
                    description: item.description || '',
                }));

                const title = nodeConfig.titleTemplate
                    ? nodeConfig.titleTemplate.replace(/\{\{count\}\}/g, String(data.length))
                    : `选择器 (${data.length}项)`;

                return [{
                    type: NodeType.SELECTOR,
                    data: {
                        title,
                        collapsed: nodeConfig.collapsed ?? false,
                        assetType: 'json' as const,
                        content: {
                            mode: 'single',
                            options,
                            selectedIds: [],
                            allowAdd: false,
                            allowDelete: false,
                        }
                    },
                    position: 'below' as const,
                }];
            }

            case 'json':
            default: {
                // Create individual JSON cards for each item
                return data.map((item: any, index: number) => {
                    const schema = nodeConfig.schema && nodeConfig.schema !== 'auto'
                        ? nodeConfig.schema.map((f: any) => ({
                            id: f.key,
                            key: f.key,
                            label: f.label || f.key,
                            type: f.type,
                            widget: f.widget
                        }))
                        : Object.keys(item).map(key => ({
                            id: key,
                            key,
                            label: key.charAt(0).toUpperCase() + key.slice(1),
                            type: 'string' as const
                        }));

                    const title = nodeConfig.titleTemplate
                        ? nodeConfig.titleTemplate
                            .replace(/\{\{index\}\}/g, String(index + 1))
                            .replace(/\{\{(\w+)\}\}/g, (_, k: string) => item[k] ?? '')
                        : `#${index + 1}`;

                    return {
                        type: NodeType.FORM,
                        data: {
                            title,
                            collapsed: nodeConfig.collapsed ?? true,
                            assetType: 'json' as const,
                            content: { schema, values: item }
                        },
                        position: index === 0 ? 'below' as const : undefined,
                        dockedTo: index > 0 ? '$prev' as const : undefined,
                    };
                });
            }
        }
    }



    public addNode(type: NodeType | string, position: XYPosition, options: { valueType?: ValueType, content?: any, assetId?: string, assetName?: string, metadata?: any, style?: any } = {}) {
        // Check if it's a virtual recipe type (e.g., "recipe:math.divide")
        const isVirtualRecipe = typeof type === 'string' && type.startsWith('recipe:');

        // Get config - for virtual recipes, look up by the full type string
        const config = nodesConfig[type] || nodesConfig[NodeType.FORM];

        // Node type is used directly (no legacy routing needed)
        const finalType: string = type as string;



        // Asset creation logic - check node's self-declaration (no hardcoded list)
        let assetId = options.assetId;
        const nodeConfigForAsset = nodesConfig[finalType];
        const isAssetNode = nodeConfigForAsset?.requiresAsset === true;

        // Create asset for regular asset nodes
        if (isAssetNode && !assetId) {
            // Use node's declared default asset type
            let valueType: ValueType = options.valueType || toValueType(nodeConfigForAsset?.defaultAssetType || 'json');
            let content = options.content;
            const name = options.assetName || config.title;
            const extraMeta = options.metadata || {};

            // Use factory to get default content (Design: no switch/case on node types)
            if (!content) {
                if (nodeConfigForAsset?.createDefaultContent) {
                    content = nodeConfigForAsset.createDefaultContent();
                } else {
                    content = ''; // Fallback
                }
            }

            // Use AssetSystem
            assetId = this.engine.assets.create(valueType, content, { name });
        }

        // Create asset for recipe nodes (FormAssetContent to store values)
        if (isVirtualRecipe && !assetId) {
            const recipeName = config.title || 'Recipe';

            // Extract default values and schema from recipe inputSchema
            const recipeId = (config.defaultData as any)?.recipeId;
            const defaultValues: Record<string, any> = {};
            let schema: any[] = [];

            if (recipeId) {
                const recipe = getRecipe(recipeId);
                if (recipe?.inputSchema) {
                    // Copy schema from recipe
                    schema = recipe.inputSchema.map(field => ({ ...field }));
                    // Extract default values
                    for (const field of recipe.inputSchema) {
                        if (field.defaultValue !== undefined) {
                            defaultValues[field.key] = field.defaultValue;
                        }
                    }
                }
            }

            const content = { schema, values: defaultValues };
            assetId = this.engine.assets.create('record', content, { name: recipeName, config: { schema } });
        }

        const nodeTitle = (options as any).title || options.assetName || config.title;

        // Build node data - merge defaultData from config if present
        // Extract recipeId from defaultData to set it at top level
        const defaultData = config.defaultData || {};
        const recipeId = (defaultData as any).recipeId;
        const dockedTo = (options as any).dockedTo;

        const nodeData: any = {
            title: nodeTitle,
            state: 'idle',
            assetId,
            recipeId, // Top-level for persistence
            ...(dockedTo ? { dockedTo } : {}), // Include docking if specified
            ...defaultData
        };

        const newNode: SynniaNode = {
            id: uuidv4(),
            type: finalType,
            position,
            data: nodeData,
            style: {
                // Use defaultStyle from node config (Design: no hardcoded dimensions)
                ...(config.defaultStyle || {}),
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

        // Only nodes with requiresAsset or RECIPE can have shortcuts
        const nodeConfig = nodesConfig[node.type];
        const canShortcut = nodeConfig?.requiresAsset || node.type === NodeType.RECIPE;
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
