import { FieldDefinition } from '@/types/assets';

/**
 * Each option is a dynamic object with custom fields defined by schema.
 * The only required field is 'id'. 'label' is used for display (first field or id).
 */
export interface SelectorOption {
    id: string;
    [key: string]: any; // Dynamic fields based on schema
}

/**
 * Default schema fields (used when user doesn't define custom schema)
 */
export const DEFAULT_OPTION_SCHEMA: FieldDefinition[] = [
    { key: 'label', label: 'Label', type: 'string', widget: 'text' },
    { key: 'description', label: 'Description', type: 'string', widget: 'text' },
];

export interface SelectorAssetContent {
    mode: 'single' | 'multi';
    showSearch: boolean;
    schema: FieldDefinition[];  // Unified schema (renamed from optionSchema)
    options: SelectorOption[];
    selected: string[]; // array of option IDs
}
