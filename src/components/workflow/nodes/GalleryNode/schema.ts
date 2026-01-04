import type { FieldDefinition } from '@/types/assets';
import { IMAGE_SCHEMA } from '../ImageNode/schema';

/**
 * Fixed schema for GalleryNode item assets.
 * Extends IMAGE_SCHEMA with gallery-specific fields.
 */
export const GALLERY_ITEM_SCHEMA: FieldDefinition[] = [
    {
        key: 'id',
        label: 'ID',
        type: 'string'
    },
    ...IMAGE_SCHEMA,
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
    {
        key: 'mediaAssetId',
        label: 'Media Asset ID',
        type: 'string'
    },
];
