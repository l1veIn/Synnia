/**
 * File Aggregate - Domain model for imported media files.
 * 
 * Represents a heavy resource (image, video, audio) that has been
 * imported into the project. Nodes reference files via fileIds.
 */

import type { FileMetadata } from './FileMetadata';
import type { FileVariants } from './FileVariants';

export type MediaType = 'image' | 'video' | 'audio' | 'document';
export type FileSource = 'import' | 'generate' | 'url' | 'paste';
export type StorageType = 'local' | 'cloud' | 'remote';

export interface File {
    /** Unique identifier */
    id: string;
    /** Media type classification */
    mediaType: MediaType;
    /** MIME type (e.g., image/png, video/mp4) */
    mimeType: string;
    /** How the file was sourced */
    source: FileSource;
    /** Storage location type */
    storage: StorageType;
    /** Project-relative path to the file */
    relativePath: string;
    /** Original filename before import */
    originalName?: string;
    /** Dimensional and temporal metadata */
    metadata: FileMetadata;
    /** File variants (thumbnail, preview, etc.) */
    variants: FileVariants;
    /** Creation timestamp */
    createdAt: number;
    /** Last update timestamp */
    updatedAt: number;
}

/**
 * Factory function to create a File entity.
 */
export function createFile(params: {
    id: string;
    mediaType: MediaType;
    mimeType: string;
    relativePath: string;
    source?: FileSource;
    storage?: StorageType;
    originalName?: string;
    metadata?: Partial<FileMetadata>;
    variants?: Partial<FileVariants>;
}): File {
    const now = Date.now();
    return {
        id: params.id,
        mediaType: params.mediaType,
        mimeType: params.mimeType,
        source: params.source ?? 'import',
        storage: params.storage ?? 'local',
        relativePath: params.relativePath,
        originalName: params.originalName,
        metadata: {
            width: params.metadata?.width,
            height: params.metadata?.height,
            duration: params.metadata?.duration,
            fileSize: params.metadata?.fileSize,
            ext: params.metadata?.ext,
        },
        variants: {
            thumbnail: params.variants?.thumbnail,
            preview: params.variants?.preview,
            optimized: params.variants?.optimized,
        },
        createdAt: now,
        updatedAt: now,
    };
}
