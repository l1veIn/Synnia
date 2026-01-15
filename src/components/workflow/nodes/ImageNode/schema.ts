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
    }
];
