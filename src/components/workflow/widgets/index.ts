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
import { LLMConfiguratorWidget } from './LLMConfigurator';
import { ImagePickerWidget } from './ImagePicker';
import { TextInputWidget } from './TextInput';
import { TextAreaWidget } from './TextArea';
import { JSONInputWidget } from './JSONInput';
import { AspectRatioSelectorWidget } from './AspectRatioSelector';

// Register all widgets
widgetRegistry.register(ModelConfiguratorWidget);
widgetRegistry.register(LLMConfiguratorWidget);
widgetRegistry.register(ImagePickerWidget);
widgetRegistry.register(TextInputWidget);
widgetRegistry.register(TextAreaWidget);
widgetRegistry.register(JSONInputWidget);
widgetRegistry.register(AspectRatioSelectorWidget);

// Re-export components for backward compatibility
export { ModelConfigurator } from './ModelConfigurator';
export type { ModelConfigValue } from './ModelConfigurator';
export { LLMConfigurator } from './LLMConfigurator';
export type { LLMConfigValue } from './LLMConfigurator';
export { ImagePicker } from './ImagePicker';
export type { ImagePickerValue } from './ImagePicker';
export { TextInput } from './TextInput';
export { TextArea } from './TextArea';
export { JSONInput } from './JSONInput';
export { AspectRatioSelector } from './AspectRatioSelector';

console.log('[Widgets] Registry initialized:', widgetRegistry.getAll().map(w => w.id).join(', '));
