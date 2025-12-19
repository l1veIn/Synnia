// Widget System - Entry Point
// Re-exports all widget functionality

export * from './types';
export * from './registry';

// ============================================================================
// Register Built-in Widgets
// ============================================================================

import { widgetRegistry } from './registry';

// Widget definitions
import { modelConfiguratorWidget } from './definitions/model-configurator';

// Register all widgets
widgetRegistry.register(modelConfiguratorWidget);

console.log('[Widgets] Widget registry initialized with:', widgetRegistry.getAll().map(w => w.id).join(', '));
