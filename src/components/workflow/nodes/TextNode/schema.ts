import type { FieldDefinition } from '@/types/assets';

/**
 * Fixed schema for TextNode assets.
 * TextNode stores structured text with content and format.
 */
export const TEXT_SCHEMA: FieldDefinition[] = [
    {
        key: 'content',
        label: 'Content',
        type: 'string',
        widget: 'textarea'
    },
    {
        key: 'format',
        label: 'Format',
        type: 'string',
        widget: 'select',
        config: { options: ['plain', 'markdown', 'json'] },
        defaultValue: 'plain'
    },
];
