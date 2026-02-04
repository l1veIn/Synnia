/**
 * FileVariants - Represents different versions/renditions of a file.
 * 
 * Used for thumbnails, previews, and optimized versions.
 */

export type FileVariantType = 'thumbnail' | 'preview' | 'optimized';

export interface FileVariant {
    type: FileVariantType;
    /** Relative path to the variant file */
    path: string;
    /** Width in pixels */
    width?: number;
    /** Height in pixels */
    height?: number;
}

export interface FileVariants {
    thumbnail?: FileVariant;
    preview?: FileVariant;
    optimized?: FileVariant;
}
