/**
 * Unified heavy resource import function.
 * 
 * Handles importing images (and future: audio, video, documents) from file paths
 * or base64 data, creating assets and nodes in one unified interface.
 */

import { apiClient } from '@/lib/apiClient';
import { graphEngine } from '@core/engine/GraphEngine';
import { useWorkflowStore } from '@/store/workflowStore';
import { toast } from 'sonner';

// ============================================
// Types
// ============================================

export interface ImportHeavyNodeOptions {
    /** Position to create the node at */
    position?: { x: number; y: number };
    /** Custom name for the asset (defaults to filename) */
    name?: string;
    /** Standard node dimensions */
    style?: { width: number; height: number };
}

export interface ImportHeavyNodeResult {
    nodeId: string;
    assetId: string;
    mediaType: string;
}

/** Backend response from import_resource command */
interface ImportResourceResponse {
    assetId: string;
    mediaType: string;
    mimeType: string;
    relativePath: string;
    thumbnailPath: string | null;
    metadata: {
        width?: number;
        height?: number;
        duration?: number;
        [key: string]: unknown;
    };
}

// ============================================
// Media Type → Node Type Mapping
// ============================================

const MEDIA_TYPE_TO_NODE_TYPE: Record<string, string> = {
    image: 'image',
    audio: 'audio',
    video: 'video',
    // Future expansion:
    // pdf: 'pdf',
    // document: 'document',
};

/** Standard node dimensions */
const STD_WIDTH = 384;
const STD_HEIGHT = 240;

// ============================================
// Asset Sync
// ============================================

/**
 * Sync a backend-created asset to frontend Zustand store.
 * Called after import_resource creates an asset that doesn't exist in the frontend.
 */
async function syncAssetFromBackend(assetId: string): Promise<void> {
    try {
        const resp = await apiClient.getMediaAssets({ ids: [assetId] });
        const assetInfo = resp.items[0];

        if (!assetInfo) {
            console.warn('[importHeavyNode] Asset not found in backend:', assetId);
            return;
        }

        const { assets } = useWorkflowStore.getState();

        if (!assets[assetId]) {
            useWorkflowStore.setState({
                assets: {
                    ...assets,
                    [assetId]: {
                        id: assetId,
                        valueType: 'record',
                        value: { src: assetInfo.content },
                        config: {
                            meta: {
                                preview: assetInfo.thumbnailPath,
                                width: assetInfo.width,
                                height: assetInfo.height,
                            }
                        },
                        sys: {
                            name: assetInfo.name,
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                            source: 'import',
                            isLibraryAsset: true,
                        }
                    } as any
                }
            });
            console.log('[importHeavyNode] Synced asset to store:', assetId);
        }
    } catch (e) {
        console.error('[importHeavyNode] Failed to sync asset:', e);
        throw e;
    }
}

// ============================================
// Main Import Function
// ============================================

/**
 * Import a heavy resource (image, audio, video) and create the corresponding node.
 * 
 * @param source - File path (Tauri) or base64 data URL
 * @param options - Import options (position, name, style)
 * @returns Promise with nodeId, assetId, and mediaType
 * 
 * @example
 * // From file path (Tauri)
 * const { nodeId } = await importHeavyNode('/path/to/image.png', { position: { x: 100, y: 100 } });
 * 
 * @example
 * // From base64
 * const { nodeId } = await importHeavyNode('data:image/png;base64,...', { name: 'My Image' });
 */
export async function importHeavyNode(
    source: string,
    options: ImportHeavyNodeOptions = {}
): Promise<ImportHeavyNodeResult> {
    const { position = { x: 150, y: 150 }, name, style } = options;

    // 1. Call backend unified import command
    const result = await apiClient.invoke<ImportResourceResponse>('import_resource', {
        source,
        name: name ?? undefined,
    });

    // 2. Sync asset to frontend store
    await syncAssetFromBackend(result.assetId);

    // 3. Determine node type from media type
    const nodeType = MEDIA_TYPE_TO_NODE_TYPE[result.mediaType];

    if (!nodeType) {
        throw new Error(`Unsupported media type: ${result.mediaType}`);
    }

    // 4. Calculate node size from metadata
    const nodeStyle = style ?? {
        width: STD_WIDTH,
        height: result.metadata.height && result.metadata.width
            ? Math.round(STD_WIDTH * (result.metadata.height / result.metadata.width))
            : STD_HEIGHT,
    };

    // 5. Create node with backend-created asset
    const nodeId = graphEngine.mutator.createSmart({
        assetId: result.assetId,
        node: nodeType,
        name: name ?? source.split(/[/\\]/).pop() ?? 'Imported',
        position,
        style: nodeStyle,
    });

    return {
        nodeId,
        assetId: result.assetId,
        mediaType: result.mediaType,
    };
}

/**
 * Import a File object (from browser drag-drop or file input).
 * Converts to base64 and calls importHeavyNode.
 * 
 * @param file - File object from browser
 * @param options - Import options
 */
export async function importHeavyNodeFromFile(
    file: File,
    options: ImportHeavyNodeOptions = {}
): Promise<ImportHeavyNodeResult> {
    // Size limit for base64 (50MB)
    const MAX_SIZE = 50 * 1024 * 1024;

    if (file.size > MAX_SIZE) {
        throw new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB (max ${MAX_SIZE / 1024 / 1024}MB)`);
    }

    // Convert to base64
    const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });

    return importHeavyNode(base64, {
        ...options,
        name: options.name ?? file.name,
    });
}

/**
 * Wrapper with toast notifications for UI interactions.
 */
export async function importHeavyNodeWithToast(
    source: string | File,
    options: ImportHeavyNodeOptions = {}
): Promise<ImportHeavyNodeResult | null> {
    const fileName = typeof source === 'string'
        ? source.split(/[/\\]/).pop() ?? 'file'
        : source.name;

    const toastId = toast.loading(`Importing ${fileName}...`);

    try {
        const result = typeof source === 'string'
            ? await importHeavyNode(source, options)
            : await importHeavyNodeFromFile(source, options);

        toast.success(`Imported ${fileName}`, { id: toastId });
        return result;
    } catch (err) {
        console.error('[importHeavyNode] Failed:', err);
        toast.error(`Failed to import: ${err instanceof Error ? err.message : String(err)}`, { id: toastId });
        return null;
    }
}
