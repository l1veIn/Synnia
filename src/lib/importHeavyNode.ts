/**
 * Unified heavy resource import function (Facade).
 * 
 * This is a thin facade over the new DDD architecture:
 * - Domain: File aggregate + FileIngestionService
 * - Infrastructure: TauriFileAdapter
 * - Application: ImportFileUseCase
 * 
 * Handles importing images, audio, video from file paths or base64 data.
 */

import { graphEngine } from '@core/engine/GraphEngine';
import { useWorkflowStore } from '@/store/workflowStore';
import { toast } from 'sonner';
import { getTauriFileAdapter } from '@/infrastructure/tauri/TauriFileAdapter';
import { importFileUseCase, type ImportFileInput, type ImportFileOutput } from '@/application/use-cases/import-file';
import type { File } from '@/domain/file/File';

// ============================================
// Types (re-export for backward compatibility)
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
    /** Legacy name: node-backed asset id (now aligns with nodeId) */
    assetId: string;
    mediaType: string;
}

// ============================================
// File Store Sync
// ============================================

/**
 * Sync a File entity to the frontend stores.
 * Updates both the files store (new) and assets store (legacy compat).
 */
function syncFileToStore(file: File): void {
    const { assets, files } = useWorkflowStore.getState();

    // Update files store
    useWorkflowStore.setState({
        files: {
            ...files,
            [file.id]: file,
        },
    });

    // Also sync to assets for backward compatibility during transition
    if (!assets[file.id]) {
        useWorkflowStore.setState({
            assets: {
                ...assets,
                [file.id]: {
                    id: file.id,
                    valueType: 'record',
                    value: { src: file.relativePath },
                    config: {
                        meta: {
                            preview: file.variants.thumbnail?.path,
                            width: file.metadata.width,
                            height: file.metadata.height,
                        }
                    },
                    sys: {
                        name: file.originalName ?? 'Imported',
                        createdAt: file.createdAt,
                        updatedAt: file.updatedAt,
                        source: 'import',
                        isLibraryAsset: true,
                    }
                } as any
            }
        });
    }

    console.log('[importHeavyNode] Synced file to store:', file.id);
}

/**
 * Create a node with file reference using GraphEngine.
 */
function createNodeWithFile(params: {
    fileId: string;
    nodeType: string;
    name: string;
    position: { x: number; y: number };
    style: { width: number; height: number };
}): string {
    const file = useWorkflowStore.getState().files[params.fileId];
    const src = file?.relativePath ?? '';
    return graphEngine.mutator.createSmart({
        value: src,
        fileIds: [params.fileId],  // Write fileIds to node
        node: params.nodeType,
        name: params.name,
        position: params.position,
        style: params.style,
    });
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
 */
export async function importHeavyNode(
    source: string,
    options: ImportHeavyNodeOptions = {}
): Promise<ImportHeavyNodeResult> {
    const input: ImportFileInput = {
        source,
        name: options.name,
        position: options.position,
        style: options.style,
    };

    const result = await importFileUseCase(input, {
        fileIngestionService: getTauriFileAdapter(),
        syncFileToStore,
        createNodeWithFile,
    });

    // Map to legacy result format
    return {
        nodeId: result.nodeId,
        assetId: result.nodeId,
        mediaType: result.mediaType,
    };
}

/**
 * Import a File object (from browser drag-drop or file input).
 * Converts to base64 and calls importHeavyNode.
 */
export async function importHeavyNodeFromFile(
    file: globalThis.File,
    options: ImportHeavyNodeOptions = {}
): Promise<ImportHeavyNodeResult> {
    const MAX_SIZE = 50 * 1024 * 1024;

    if (file.size > MAX_SIZE) {
        throw new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB (max ${MAX_SIZE / 1024 / 1024}MB)`);
    }

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
    source: string | globalThis.File,
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
