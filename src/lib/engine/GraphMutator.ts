import { GraphEngine } from './GraphEngine';
import { SynniaNode, NodeType } from '@/types/project';
import { AssetType } from '@/types/assets';
import { nodesConfig } from '@/components/workflow/nodes';
import { v4 as uuidv4 } from 'uuid';
import { sortNodesTopologically, sanitizeNodeForClipboard } from '@/lib/graphUtils';
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
            
            // Use AssetSystem
            assetId = this.engine.assets.create(assetType, content, { name, ...extraMeta });
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
            style: {
                ...(finalType === NodeType.GROUP ? { width: 400, height: 300 } : {}),
                ...(finalType === NodeType.RACK ? { width: 300, height: 400 } : {}),
                ...(finalType === NodeType.IMAGE ? { width: 300, height: 300 } : {}),
                ...(finalType === NodeType.TEXT ? { width: 250, height: 200 } : {}),
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
        while(queue.length > 0) {
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
            const contentClone = originalAsset.content ? JSON.parse(JSON.stringify(originalAsset.content)) : originalAsset.content;
            
            // Use AssetSystem
            newAssetId = this.engine.assets.create(
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

    public createRackFromSelection() {
       const { nodes } = this.engine.state;
       const selectedNodes = nodes.filter(n => n.selected && n.type !== NodeType.RACK && n.type !== NodeType.GROUP);
       
       if (selectedNodes.length === 0) return;
       
       // Validation: Prevent creating Rack from already nested nodes
       // This simplifies the model and avoids coordinate/layout recursion issues
       const isNested = selectedNodes.some(n => !!n.parentId);
       if (isNested) {
           console.warn("[GraphMutator] Cannot create Rack from nested nodes. Detach them first.");
           return;
       }
       
       // 1. Calculate Dimensions (Fixed Width, Stack Height)
       const minX = Math.min(...selectedNodes.map(n => n.position.x));
       const minY = Math.min(...selectedNodes.map(n => n.position.y));
       
       const FIXED_WIDTH = 300;
       const GAP = 10;
       const PADDING_TOP = 60; // Header + Top Padding
       const PADDING_BOTTOM = 20;

       let stackHeight = 0;
       selectedNodes.forEach(n => {
           // Estimate node height (priority: style > measured > fallback)
           let h = n.style?.height;
           if (typeof h !== 'number') {
               h = n.measured?.height || n.height || 150; // Default to standard height if unknown
           }
           stackHeight += (typeof h === 'number' ? h : 150) + GAP;
       });
       
       const rackId = uuidv4();
       
       // 2. Create Rack Node
       const rackNode: SynniaNode = {
           id: rackId,
           type: NodeType.RACK,
           position: { x: minX - 20, y: minY - 50 },
           parentId: undefined, // Always root as per nested check
           data: { title: 'New Rack', state: 'idle' },
           style: { 
               width: FIXED_WIDTH, 
               height: stackHeight + PADDING_TOP + PADDING_BOTTOM
           },
           selected: true,
           draggable: true
       };
       
       const newNodes = [...nodes, rackNode];
       this.engine.setNodes(newNodes);

       // 3. Prepare nodes for Rack (Collapse them)
       const selectedIds = selectedNodes.map(n => n.id);
       const updates = selectedIds.map(id => {
           const node = nodes.find(n => n.id === id)!;
           // Determine current height to backup
           // Priority: style > measured > fallback
           let currentHeight = node.style?.height;
           if (typeof currentHeight !== 'number') {
                currentHeight = node.measured?.height || node.height;
           }

           return {
               id,
               patch: {
                   style: {
                       ...node.style,
                       height: 50 // Force small height immediately
                   },
                   height: 50, // Force top-level height for React Flow
                   data: { 
                       ...node.data, 
                       collapsed: true,
                       other: {
                           ...(node.data.other || {}),
                           // Backup height if it's a number and reasonable (not already collapsed size)
                           expandedHeight: (typeof currentHeight === 'number' && currentHeight > 60) ? currentHeight : undefined
                       }
                   }
               } as Partial<SynniaNode>
           };
       });
       this.engine.updateNodes(updates);

       // 4. Batch Reparent Selected Nodes into Rack
       this.engine.reparentNodes(selectedIds, rackId);
    }

    public createShortcut(nodeId: string) {
        const { nodes } = this.engine.state;
        const node = nodes.find(n => n.id === nodeId);
        
        const contentTypes = [NodeType.ASSET, NodeType.TEXT, NodeType.IMAGE, NodeType.JSON, NodeType.RECIPE];
        if (!node || !contentTypes.includes(node.type as NodeType)) return;

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
                   const contentClone = originalAsset.content ? JSON.parse(JSON.stringify(originalAsset.content)) : originalAsset.content;
                   
                   // Use AssetSystem
                   newAssetId = this.engine.assets.create(
                       originalAsset.type,
                       contentClone,
                       { name: `${originalAsset.metadata.name} (Copy)` }
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
