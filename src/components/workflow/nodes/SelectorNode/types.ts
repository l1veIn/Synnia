import { FieldDefinition } from '@/types/assets';

/**
 * View mode for SelectorNode
 */
export type ViewMode = 'list' | 'combobox' | 'card';

/**
 * Individual option item in the selector
 */
export interface SelectorOption {
    id: string;
    [key: string]: any;
}

/**
 * Field mapping for smart display
 */
export interface FieldMapping {
    title: string;      // Primary display field key
    subtitle?: string;  // Secondary field key
    avatar?: string;    // Image field key for CardView
    description?: string; // Long text field key
}

/**
 * Card layout configuration
 */
export interface CardLayoutConfig {
    columns: number;  // 1-6
    orientation: 'vertical' | 'horizontal';
    showAvatar: boolean;
    showSubtitle: boolean;
}

/**
 * Extra config for SelectorNode (stored in asset.config.extra)
 */
export interface SelectorExtra {
    // Selection
    mode: 'single' | 'multi';
    selected: string[];

    // View
    viewMode: ViewMode;

    // UI toggles
    showSearch: boolean;
    showBulkActions: boolean;

    // Field mapping
    fieldMapping?: Partial<FieldMapping>;

    // CardView specific
    cardLayout?: Partial<CardLayoutConfig>;
}

/**
 * Full selector content (derived from asset)
 */
export interface SelectorContent {
    mode: 'single' | 'multi';
    viewMode: ViewMode;
    showSearch: boolean;
    showBulkActions: boolean;
    schema: FieldDefinition[];
    options: SelectorOption[];
    selected: string[];
    fieldMapping: FieldMapping;
    cardLayout: CardLayoutConfig;
}

/**
 * Default schema for options
 */
export const DEFAULT_OPTION_SCHEMA: FieldDefinition[] = [
    { key: 'label', label: 'Label', type: 'string', widget: 'text' },
    { key: 'description', label: 'Description', type: 'string', widget: 'text' },
];

/**
 * Default field mapping (will be overridden by smart detection)
 */
export const DEFAULT_FIELD_MAPPING: FieldMapping = {
    title: 'label',
    subtitle: undefined,
    avatar: undefined,
    description: 'description',
};

/**
 * Default card layout
 */
export const DEFAULT_CARD_LAYOUT: CardLayoutConfig = {
    columns: 3,
    orientation: 'vertical',
    showAvatar: true,
    showSubtitle: true,
};

/**
 * Smart field mapping detection
 */
export function detectFieldMapping(schema: FieldDefinition[]): FieldMapping {
    const mapping: FieldMapping = { title: 'id' };

    // Priority lists for each role
    const titleCandidates = ['name', 'title', 'label'];
    const subtitleCandidates = ['tagline', 'subtitle', 'summary', 'style'];
    const avatarCandidates = ['avatar', 'image', 'cover', 'thumbnail', 'photo'];
    const descCandidates = ['description', 'rationale', 'content', 'text', 'detail'];

    const stringFields = schema.filter(f => f.type === 'string');

    // Find title (first match or first string field)
    for (const candidate of titleCandidates) {
        const field = stringFields.find(f => f.key.toLowerCase() === candidate);
        if (field) {
            mapping.title = field.key;
            break;
        }
    }
    // Fallback to first string field
    if (mapping.title === 'id' && stringFields.length > 0) {
        mapping.title = stringFields[0].key;
    }

    // Find subtitle
    for (const candidate of subtitleCandidates) {
        const field = stringFields.find(f => f.key.toLowerCase() === candidate && f.key !== mapping.title);
        if (field) {
            mapping.subtitle = field.key;
            break;
        }
    }

    // Find avatar (check widget or name)
    for (const field of schema) {
        const widgetStr = field.widget as string | undefined;
        if (widgetStr === 'image' || avatarCandidates.includes(field.key.toLowerCase())) {
            mapping.avatar = field.key;
            break;
        }
    }

    // Find description (longest string field or by name)
    for (const candidate of descCandidates) {
        const field = stringFields.find(f =>
            f.key.toLowerCase() === candidate &&
            f.key !== mapping.title &&
            f.key !== mapping.subtitle
        );
        if (field) {
            mapping.description = field.key;
            break;
        }
    }

    return mapping;
}

/**
 * Common props for all view components
 */
export interface ViewProps {
    options: SelectorOption[];
    selected: string[];
    onSelect: (optionId: string) => void;
    mode: 'single' | 'multi';
    schema: FieldDefinition[];
    fieldMapping: FieldMapping;
    searchQuery: string;
    isDisabled?: boolean;
    cardLayout?: CardLayoutConfig;  // Optional for non-card views
}

/**
 * Props for CardView specific settings (cardLayout is required)
 */
export interface CardViewProps extends Omit<ViewProps, 'cardLayout'> {
    cardLayout: CardLayoutConfig;
}
