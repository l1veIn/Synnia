import { SynniaNode, NodeType } from '@/types/project';
import { Asset, FormAssetContent } from '@/types/assets';
import { useWorkflowStore } from '@/store/workflowStore';

export interface DataPayload {
    type: 'text' | 'image' | 'json' | 'array' | 'unknown';
    value: any;
    metadata?: any;
}

/**
 * Extracts the runtime payload from a node.
 * This is the "Source of Truth" for data flow between nodes.
 * It resolves Assets, Groups, and Racks into consumable JSON data.
 */
export const getNodePayload = (nodeId: string): DataPayload | null => {
    const store = useWorkflowStore.getState();
    const node = store.nodes.find(n => n.id === nodeId);
    if (!node) return null;

    // 1. Rack / Group (Array of children payloads)
    if (node.type === NodeType.RACK || node.type === NodeType.GROUP) {
        // Find children (sorted by Y position to maintain visual order = logical order)
        const children = store.nodes
            .filter(n => n.parentId === nodeId)
            .sort((a, b) => a.position.y - b.position.y);
        
        const list = children
            .map(child => getNodePayload(child.id))
            .filter(p => p !== null)
            .map(p => p!.value); // Flatten to raw values array

        return {
            type: 'array',
            value: list
        };
    }

    // 2. Asset Nodes (Text, Image, Recipe)
    const assetId = node.data.assetId;
    if (!assetId) return null; // No data attached

    const asset = store.assets[assetId];
    if (!asset) return null; // Asset missing

    switch (asset.type) {
        case 'text':
            return {
                type: 'text',
                value: asset.content // String
            };
        
        case 'image':
            // Construct Standard Image Object
            const meta = asset.metadata.image || {};
            let url = '';
            let path = '';
            
            // Handle different content shapes (string vs object)
            if (typeof asset.content === 'string') {
                url = asset.content;
                path = url;
            } else if (typeof asset.content === 'object' && asset.content !== null) {
                const c = asset.content as any;
                url = c.src || c.url || '';
                path = c.path || url;
            }
            
            return {
                type: 'image',
                value: {
                    url,
                    path, 
                    width: meta.width,
                    height: meta.height,
                    size: meta.size,
                    mimeType: meta.mimeType
                }
            };

        case 'json': // Recipe / Form / Generic JSON
            // For a Recipe used as input, we pass its current configured parameters
            // In the future, this might be the *output* of the recipe if we implement chaining
            if (isFormContent(asset.content)) {
                return {
                    type: 'json',
                    value: asset.content.values
                };
            }
            return {
                type: 'json',
                value: asset.content
            };

        default:
            return {
                type: 'unknown',
                value: asset.content
            };
    }
};

// Helper
const isFormContent = (content: any): content is FormAssetContent => {
    return content && typeof content === 'object' && 'values' in content && 'schema' in content;
};
