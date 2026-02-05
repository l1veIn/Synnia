/**
 * GalleryNode Type Definitions
 *
 * Gallery stores array of image references, not full image data.
 * Actual image URLs are resolved from MediaAsset library at render time.
 */

/**
 * Gallery item stored in asset.value[]
 * Only stores reference to MediaAsset, not full image data
 */
export interface GalleryImageRef {
    id: string;                   // Gallery-internal unique ID
    mediaAssetId: string;         // Reference to MediaAsset in library
    starred: boolean;             // Gallery-specific metadata
    caption?: string;             // Gallery-specific metadata
}

/**
 * Gallery display config stored in asset.config.extra
 */
export interface GalleryDisplayConfig {
    viewMode: 'grid' | 'list' | 'single';
    columnsPerRow: number;
    allowStar: boolean;
    allowDelete: boolean;
}
