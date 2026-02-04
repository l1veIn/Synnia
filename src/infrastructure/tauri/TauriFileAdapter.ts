/**
 * TauriFileAdapter - Infrastructure adapter for file ingestion.
 * 
 * Implements FileIngestionService by calling the Tauri backend's
 * import_resource command.
 */

import { apiClient } from '@/lib/apiClient';
import type { FileIngestionService, IngestFileInput, IngestFileOutput } from '@/domain/file/FileIngestionService';
import { createFile, type MediaType } from '@/domain/file/File';

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

export class TauriFileAdapter implements FileIngestionService {
    async ingest(input: IngestFileInput): Promise<IngestFileOutput> {
        const result = await apiClient.invoke<ImportResourceResponse>('import_resource', {
            source: input.source,
            name: input.name,
        });

        const file = createFile({
            id: result.assetId,
            mediaType: result.mediaType as MediaType,
            mimeType: result.mimeType,
            relativePath: result.relativePath,
            source: 'import',
            storage: 'local',
            originalName: input.name,
            metadata: {
                width: result.metadata?.width,
                height: result.metadata?.height,
                duration: result.metadata?.duration,
            },
            variants: result.thumbnailPath ? {
                thumbnail: {
                    type: 'thumbnail',
                    path: result.thumbnailPath,
                },
            } : undefined,
        });

        return { file };
    }
}

/** Singleton instance */
let adapterInstance: TauriFileAdapter | null = null;

export function getTauriFileAdapter(): TauriFileAdapter {
    if (!adapterInstance) {
        adapterInstance = new TauriFileAdapter();
    }
    return adapterInstance;
}
