// Widget System - Entry Point
// Central registry for all workflow widgets

export * from './types';
export * from './registry';

// ============================================================================
// Register Built-in Widgets
// ============================================================================

import { widgetRegistry } from './registry';

// Self-contained widget definitions
import { ModelConfiguratorWidget } from './ModelConfigurator';

// Register all widgets
widgetRegistry.register(ModelConfiguratorWidget);

console.log('[Widgets] Registry initialized:', widgetRegistry.getAll().map(w => w.id).join(', '));
