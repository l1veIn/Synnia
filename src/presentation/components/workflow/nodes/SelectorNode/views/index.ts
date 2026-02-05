/**
 * View Components Registry
 * All view implementations for SelectorNode
 */

export { ListView } from './ListView';
export { ComboBoxView } from './ComboBoxView';
export { CardView } from './CardView';

// Shared components
export { HighlightedText } from './HighlightedText';
export { SelectionIndicator } from './SelectionIndicator';
export { BulkActions } from './BulkActions';

import { ListView } from './ListView';
import { ComboBoxView } from './ComboBoxView';
import { CardView } from './CardView';
import type { ViewMode } from '../types';

/**
 * View registry for dynamic view selection
 */
export const viewRegistry = {
    list: ListView,
    combobox: ComboBoxView,
    card: CardView,
} as const;

export type ViewRegistry = typeof viewRegistry;

/**
 * Get view component by mode
 */
export function getViewComponent(mode: ViewMode) {
    return viewRegistry[mode] || ListView;
}
