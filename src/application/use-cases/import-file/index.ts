/**
 * ImportFileUseCase - Application layer use case for file import.
 * 
 * Orchestrates:
 * 1. File ingestion via FileIngestionService
 * 2. File storage sync
 * 3. Node creation with fileIds reference
 */

import type { FileIngestionService } from '@/domain/file/FileIngestionService';
import type { File } from '@/domain/file/File';

export interface ImportFileInput {
    /** File path (local) or base64 data URL */
    source: string;
    /** Optional custom name */
    name?: string;
    /** Node position on canvas */
    position?: { x: number; y: number };
    /** Node dimensions */
    style?: { width: number; height: number };
}

export interface ImportFileDeps {
    /** File ingestion service (port) */
    fileIngestionService: FileIngestionService;
    /** Sync file to store */
    syncFileToStore: (file: File) => void;
    /** Create node with file reference */
    createNodeWithFile: (params: {
        fileId: string;
        nodeType: string;
        name: string;
        position: { x: number; y: number };
        style: { width: number; height: number };
    }) => string;
}

export interface ImportFileOutput {
    nodeId: string;
    fileId: string;
    mediaType: string;
}

/** Standard node dimensions */
const STD_WIDTH = 384;
const STD_HEIGHT = 240;

/** Media type to node type mapping */
const MEDIA_TYPE_TO_NODE_TYPE: Record<string, string> = {
    image: 'image',
    audio: 'audio',
    video: 'video',
};

export async function importFileUseCase(
    input: ImportFileInput,
    deps: ImportFileDeps
): Promise<ImportFileOutput> {
    const { position = { x: 150, y: 150 }, name, style } = input;

    // 1. Ingest file via service
    const { file } = await deps.fileIngestionService.ingest({
        source: input.source,
        name,
    });

    // 2. Sync file to store
    deps.syncFileToStore(file);

    // 3. Determine node type
    const nodeType = MEDIA_TYPE_TO_NODE_TYPE[file.mediaType];
    if (!nodeType) {
        throw new Error(`Unsupported media type: ${file.mediaType}`);
    }

    // 4. Calculate node size from metadata
    const nodeStyle = style ?? {
        width: STD_WIDTH,
        height: file.metadata.height && file.metadata.width
            ? Math.round(STD_WIDTH * (file.metadata.height / file.metadata.width))
            : STD_HEIGHT,
    };

    // 5. Create node with file reference
    const nodeId = deps.createNodeWithFile({
        fileId: file.id,
        nodeType,
        name: name ?? file.originalName ?? input.source.split(/[/\\]/).pop() ?? 'Imported',
        position,
        style: nodeStyle,
    });

    return {
        nodeId,
        fileId: file.id,
        mediaType: file.mediaType,
    };
}
