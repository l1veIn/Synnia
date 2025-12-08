import { GraphEngine } from './GraphEngine';
import { SynniaNode, NodeType } from '@/types/project';
import { AssetType } from '@/types/assets';
import { nodesConfig } from '@/components/workflow/nodes';
import { v4 as uuidv4 } from 'uuid';
import { sortNodesTopologically, sanitizeNodeForClipboard } from '@/lib/graphUtils';
import { fixRackLayout } from '@/lib/rackLayout';
import { useWorkflowStore } from '@/store/workflowStore';
import { XYPosition } from '@xyflow/react';

export class GraphMutator {
    private engine: GraphEngine;

    constructor(engine: GraphEngine) {
        this.engine = engine;
    }

    public addNode(type: NodeType, position: XYPosition, options: { assetType?: AssetType, content?: any, assetId?: string, assetName?: string, metadata?: any, style?: any } = {}) {
        let finalType = type;
        if (type === NodeType.ASSET) {
            const assetType = options.assetType || 'text';
            switch (assetType) {
                case 'text': finalType = NodeType.TEXT; break;
                case 'image': finalType = NodeType.IMAGE; break;
                case 'json': finalType = NodeType.JSON; break;
            }
        }

        const config = nodesConfig[finalType] || nodesConfig[NodeType.ASSET];
        const isGroup = finalType === NodeType.GROUP;
        
        let assetId = options.assetId;
        const isAssetNode = [NodeType.ASSET, NodeType.TEXT, NodeType.IMAGE, NodeType.JSON, NodeType.RECIPE].includes(finalType);

        if (isAssetNode && !assetId) {
            let assetType = options.assetType;
            let content = options.content;
            const name = options.assetName || config.title;
            const extraMeta = options.metadata || {};

            if (finalType === NodeType.RECIPE) {
                assetType = 'json';
                if (!content) {
                    content = { schema: [], values: {} };
                }
            } else {
                if (!assetType) {
                    if (finalType === NodeType.TEXT) assetType = 'text';
                    else if (finalType === NodeType.IMAGE) assetType = 'image';
                    else if (finalType === NodeType.JSON) assetType = 'json';
                    else assetType = 'text';
                }
                content = content || '';
            }
            
            // Delegate Asset Creation to Store (until AssetSystem is ready)
            assetId = useWorkflowStore.getState().createAsset(assetType, content, { name, ...extraMeta });
        }

        const nodeTitle = options.assetName || config.title;

        const newNode: SynniaNode = {
            id: uuidv4(),
            type: finalType,
            position,
            data: {
                title: nodeTitle,
                state: 'idle',
                assetId,
            },
            ...(isGroup ? {
                style: { width: 400, height: 300 },
            } : {}),
            style: options.style || {},
        };

        const { nodes } = this.engine.state;
        const newNodes = [...nodes, newNode];
        this.engine.setNodes(sortNodesTopologically(newNodes));
        
        return newNode.id;
    }

    public removeNode(id: string) {
        const { nodes, edges } = this.engine.state;
        
        const nodesToDelete = new Set<string>();
        const queue = [id];
        
        while(queue.length > 0) {
            const currentId = queue.pop()!;
            nodesToDelete.add(currentId);
            
            const children = nodes.filter(n => n.parentId === currentId);
            children.forEach(child => queue.push(child.id));
        }
        
        const filteredNodes = nodes.filter((n) => !nodesToDelete.has(n.id));
        const finalNodes = fixRackLayout(filteredNodes) as SynniaNode[];

        this.engine.setNodes(finalNodes);
        this.engine.setEdges(edges.filter((e) => !nodesToDelete.has(e.source) && !nodesToDelete.has(e.target)));
    }

    public duplicateNode(node: SynniaNode, position?: XYPosition) {
        const { nodes, assets } = this.engine.state;
        const createAsset = useWorkflowStore.getState().createAsset;
        const newId = uuidv4();
        
        const sanitizedNode = sanitizeNodeForClipboard(node);

        let newAssetId = sanitizedNode.data.assetId;
        if (newAssetId && assets[newAssetId]) {
            const originalAsset = assets[newAssetId];
            const contentClone = originalAsset.content ? JSON.parse(JSON.stringify(originalAsset.content)) : originalAsset.content;
            
            newAssetId = createAsset(
                originalAsset.type, 
                contentClone,
                { 
                    name: `${originalAsset.metadata.name} (Copy)`,
                    source: 'user'
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
        
        const deselectedNodes = nodes.map(n => ({ ...n, selected: false }));
        const finalNodes = sortNodesTopologically([...deselectedNodes, newNode]);
        this.engine.setNodes(finalNodes);
    }

    public detachNode(nodeId: string) {
        const { nodes } = this.engine.state;
        const node = nodes.find(n => n.id === nodeId);
        if (!node || !node.parentId) return;

        const parent = nodes.find(n => n.id === node.parentId);
        
        let newPos = { ...node.position };
        if (parent) {
            newPos = {
                x: parent.position.x + node.position.x,
                y: parent.position.y + node.position.y
            };
        }
        
        const sanitizedNode = sanitizeNodeForClipboard(node);
        
        const updatedNode = {
            ...sanitizedNode,
            id: nodeId,
            parentId: undefined,
            extent: undefined,
            position: newPos,
            draggable: true,
            hidden: false,
            style: { ...sanitizedNode.style, width: undefined, height: undefined },
            data: {
                ...sanitizedNode.data,
                collapsed: false, 
                handlePosition: 'top-bottom'
            }
        } as SynniaNode;
        
        let finalNodes = nodes.map(n => n.id === nodeId ? updatedNode : n);
        finalNodes = fixRackLayout(finalNodes) as SynniaNode[];
        
        this.engine.setNodes(sortNodesTopologically(finalNodes));
    }

    public createRackFromSelection() {
       const { nodes } = this.engine.state;
       const selectedNodes = nodes.filter(n => n.selected && n.type !== NodeType.RACK && n.type !== NodeType.GROUP);
       
       if (selectedNodes.length === 0) return;
       
       const minX = Math.min(...selectedNodes.map(n => n.position.x));
       const minY = Math.min(...selectedNodes.map(n => n.position.y));
       
       const rackId = uuidv4();
       
       const rackNode: SynniaNode = {
           id: rackId,
           type: NodeType.RACK,
           position: { x: minX - 20, y: minY - 50 },
           data: { title: 'New Rack', state: 'idle' },
           style: { width: 300, height: 400 },
           selected: true,
           draggable: true
       };
       
       const sortedNodes = [...selectedNodes].sort((a, b) => a.position.y - b.position.y);
       
       const updatedChildren = sortedNodes.map(node => ({
           ...node,
           parentId: rackId,
           extent: 'parent',
           position: { x: 0, y: 0 },
           selected: false,
           data: { ...node.data, collapsed: true } // Force collapse for Rack
       } as SynniaNode));
       
       const selectedIds = new Set(selectedNodes.map(n => n.id));
       const unselectedNodes = nodes.filter(n => !selectedIds.has(n.id));

       let allNodes = [...unselectedNodes, rackNode, ...updatedChildren];
       
       allNodes = fixRackLayout(allNodes) as SynniaNode[];
       
       this.engine.setNodes(sortNodesTopologically(allNodes));
    }

    public pasteNodes(copiedNodes: SynniaNode[]) {
       const { nodes, assets } = this.engine.state;
       const createAsset = useWorkflowStore.getState().createAsset;
       
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
                   const contentClone = originalAsset.content ? JSON.parse(JSON.stringify(originalAsset.content)) : originalAsset.content;
                   newAssetId = createAsset(
                       originalAsset.type,
                       contentClone,
                       { name: `${originalAsset.metadata.name} (Copy)` }
                   );
               } else {
                   newAssetId = createAsset(
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

       const deselectedNodes = nodes.map(n => ({ ...n, selected: false }));
       const finalNodes = sortNodesTopologically([...deselectedNodes, ...newNodes]);
       this.engine.setNodes(finalNodes);
    }
}