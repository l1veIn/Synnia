import type { FieldDefinition } from '@/types/assets';

/**
 * Fixed schema for ImageNode assets.
 * ImageNode stores image metadata following a structured format.
 */
export const IMAGE_SCHEMA: FieldDefinition[] = [
    {
        key: 'src',
        label: 'Source URL',
        type: 'string',
        widget: 'text'
    },
    {
        key: 'width',
        label: 'Width',
        type: 'number',
        widget: 'number'
    },
    {
        key: 'height',
        label: 'Height',
        type: 'number',
        widget: 'number'
    },
    {
        key: 'alt',
        label: 'Alt Text',
        type: 'string',
        widget: 'text'
    },
    {
        key: 'mimeType',
        label: 'MIME Type',
        type: 'string',
        widget: 'text'
    },
];
