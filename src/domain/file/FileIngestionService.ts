/**
 * FileIngestionService - Domain service interface (Port).
 * 
 * Defines the contract for ingesting files into the system.
 * Infrastructure adapters implement this interface.
 */

import type { File } from './File';

export interface IngestFileInput {
    /** File path (local) or base64 data URL */
    source: string;
    /** Optional custom name for the file */
    name?: string;
}

export interface IngestFileOutput {
    /** The created File entity */
    file: File;
}

/**
 * Port interface for file ingestion.
 * Implemented by infrastructure adapters (e.g., TauriFileAdapter).
 */
export interface FileIngestionService {
    ingest(input: IngestFileInput): Promise<IngestFileOutput>;
}
