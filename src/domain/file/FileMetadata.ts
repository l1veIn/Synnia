/**
 * FileMetadata - Structured metadata for imported files.
 * 
 * Contains dimensional and temporal information for media files.
 */

export interface FileMetadata {
    /** Width in pixels (for image/video) */
    width?: number;
    /** Height in pixels (for image/video) */
    height?: number;
    /** Duration in seconds (for video/audio) */
    duration?: number;
    /** File size in bytes */
    fileSize?: number;
    /** Extensible metadata */
    ext?: Record<string, unknown>;
}
