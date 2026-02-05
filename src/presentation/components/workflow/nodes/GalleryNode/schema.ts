import type { FieldDefinition } from '@/domain/asset/types';

/**
 * Fixed schema for GalleryNode item assets.
 * Gallery items store references to MediaAssets, not full image data.
 */
export const GALLERY_ITEM_SCHEMA: FieldDefinition[] = [
    {
        key: 'id',
        label: 'ID',
        type: 'string'
    },
    {
        key: 'mediaAssetId',
        label: 'Media Asset ID',
        type: 'string'
    },
    {
        key: 'starred',
        label: 'Starred',
        type: 'boolean',
        widget: 'switch'
    },
    {
        key: 'caption',
        label: 'Caption',
        type: 'string',
        widget: 'text'
    },
];

