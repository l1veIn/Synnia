import { SynniaNode, NodeType } from '@/types/project';
import { Asset, FormAssetContent } from '@/types/assets';
import { DataPayload } from '@/types/node-config';
import { useWorkflowStore } from '@/store/workflowStore';
import { nodeOutputs } from '@/components/workflow/nodes';

/**
 * Get the output payload from a node for a specific handle.
 * 
 * @param nodeId - The node ID
 * @param handleId - Optional handle ID. If not provided, tries 'output' or first available.
 * @returns DataPayload or null if not found
 */
export const getNodeOutput = (nodeId: string, handleId?: string): DataPayload | null => {
    const store = useWorkflowStore.getState();
    const node = store.nodes.find(n => n.id === nodeId);
    if (!node) return null;

    // 1. Check if node type has registered output resolvers
    const outputConfig = nodeOutputs[node.type as string];

    if (outputConfig) {
        // Get the asset for this node
        const asset = node.data.assetId ? store.assets[node.data.assetId] : undefined;

        // If handleId provided, use that resolver
        if (handleId && outputConfig[handleId]) {
            return outputConfig[handleId](node, asset);
        }

        // If no handleId, try 'output' as default, or first available
        if (outputConfig['output']) {
            return outputConfig['output'](node, asset);
        }

        // Return first available output
        const firstKey = Object.keys(outputConfig)[0];
        if (firstKey) {
            return outputConfig[firstKey](node, asset);
        }
    }

    // 2. Fallback: Legacy behavior for containers
    if (node.type === NodeType.RACK || node.type === NodeType.GROUP) {
        const children = store.nodes
            .filter(n => n.parentId === nodeId)
            .sort((a, b) => a.position.y - b.position.y);

        const list = children
            .map(child => getNodeOutput(child.id))
            .filter(p => p !== null)
            .map(p => p!.value);

        return {
            type: 'array',
            value: list
        };
    }

    // 3. Fallback: Legacy asset resolution
    return getLegacyAssetPayload(node, store.assets);
};

/**
 * Legacy payload resolution for nodes without explicit outputs.
 * @deprecated Will be removed once all nodes define outputs
 */
function getLegacyAssetPayload(node: SynniaNode, assets: Record<string, Asset>): DataPayload | null {
    const assetId = node.data.assetId;
    if (!assetId) return null;

    const asset = assets[assetId];
    if (!asset) return null;

    switch (asset.type) {
        case 'text':
            return { type: 'text', value: asset.content };

        case 'image': {
            const meta = (asset.metadata?.image || {}) as {
                width?: number;
                height?: number;
                size?: number;
                mimeType?: string;
            };
            let url = '';
            let path = '';

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
                value: { url, path, width: meta.width, height: meta.height, size: meta.size, mimeType: meta.mimeType }
            };
        }

        case 'json':
            if (isFormContent(asset.content)) {
                return { type: 'json', value: asset.content.values };
            }
            return { type: 'json', value: asset.content };

        default:
            return { type: 'unknown', value: asset.content };
    }
}

const isFormContent = (content: any): content is FormAssetContent => {
    return content && typeof content === 'object' && 'values' in content && 'schema' in content;
};

// Keep old export for backward compatibility
export const getNodePayload = getNodeOutput;
