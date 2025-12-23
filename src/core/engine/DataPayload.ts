// DataPayload.ts
// Legacy shim - delegates to new Port System
// TODO: Gradually migrate callers to use PortResolver directly

import { SynniaNode, NodeType } from '@/types/project';
import { Asset } from '@/types/assets';
import { DataPayload } from '@/types/node-config';
import { useWorkflowStore } from '@/store/workflowStore';
import { resolvePort } from './ports/PortResolver';

/**
 * Get the output payload from a node for a specific handle.
 * 
 * @deprecated Use resolvePort from PortResolver instead
 * @param nodeId - The node ID
 * @param handleId - Optional handle ID. If not provided, tries 'output' or first available.
 * @returns DataPayload or null if not found
 */
export const getNodeOutput = (nodeId: string, handleId?: string): DataPayload | null => {
    const store = useWorkflowStore.getState();
    const node = store.nodes.find(n => n.id === nodeId);
    if (!node) return null;

    const asset = node.data.assetId ? store.assets[node.data.assetId] : null;
    const portId = handleId || 'output';

    // Use new port system
    const portValue = resolvePort(node, asset, portId);
    if (portValue) {
        return {
            type: portValue.type as any,
            value: portValue.value
        };
    }

    // Fallback: Legacy asset resolution
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

    // Use new Asset API: valueType instead of type, value instead of content
    switch (asset.valueType) {
        case 'text':
            return { type: 'text', value: asset.value };

        case 'image': {
            // valueMeta contains image-specific metadata for ImageAsset
            const meta = (asset.valueMeta || {}) as {
                width?: number;
                height?: number;
                size?: number;
                mimeType?: string;
            };
            let url = '';
            let path = '';

            if (typeof asset.value === 'string') {
                url = asset.value;
                path = url;
            } else if (typeof asset.value === 'object' && asset.value !== null) {
                const c = asset.value as any;
                url = c.src || c.url || '';
                path = c.path || url;
            }

            return {
                type: 'image',
                value: { url, path, width: meta.width, height: meta.height, size: meta.size, mimeType: meta.mimeType }
            };
        }

        case 'record':
            // RecordAsset: values are now directly in asset.value (no FormAssetContent wrapper)
            return { type: 'json', value: asset.value };

        case 'array':
            return { type: 'array', value: asset.value };

        default:
            // Handle future valueTypes gracefully
            return { type: 'unknown', value: (asset as any).value };
    }
}

// Keep old export for backward compatibility
export const getNodePayload = getNodeOutput;

/**
 * Resolve a DataPayload to a usable input value.
 * 
 * @deprecated Use resolveInputValue from PortResolver instead
 */
export const resolveInputValue = (payload: DataPayload | null, targetKey?: string): any => {
    if (!payload) return undefined;

    let value = payload.value;

    // Handle arrays: take first element
    if (Array.isArray(value)) {
        if (value.length === 0) return undefined;
        value = value[0];
    }

    // If result is an object and targetKey provided, try to extract same-named field
    if (value && typeof value === 'object' && !Array.isArray(value) && targetKey) {
        if (targetKey in value) {
            return value[targetKey];
        }
        if (payload.type === 'image' && (targetKey.toLowerCase().includes('url') || targetKey.toLowerCase().includes('image'))) {
            return value.url || value.src || value;
        }
    }

    return value;
};
