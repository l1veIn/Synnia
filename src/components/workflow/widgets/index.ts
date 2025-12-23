// Widget System - Entry Point
// Central registry for all workflow widgets

export * from './lib/types';
export * from './lib/registry';
export * from './lib/WidgetServices';
export { RecipeFieldRow, RecipeFormRenderer } from './lib/FieldRow';

// ============================================================================
// Register Built-in Widgets
// ============================================================================

import { widgetRegistry } from './lib/registry';

// Self-contained widget definitions
import { ModelConfiguratorWidget } from './impl/ModelConfigurator';
import { ImagePickerWidget } from './impl/ImagePicker';
import { TextInputWidget } from './impl/TextInput';
import { TextAreaWidget } from './impl/TextArea';
import { JSONInputWidget } from './impl/JSONInput';
import { AspectRatioSelectorWidget } from './impl/AspectRatioSelector';

// Register all widgets
widgetRegistry.register(ModelConfiguratorWidget);
widgetRegistry.register(ImagePickerWidget);
widgetRegistry.register(TextInputWidget);
widgetRegistry.register(TextAreaWidget);
widgetRegistry.register(JSONInputWidget);
widgetRegistry.register(AspectRatioSelectorWidget);

// Re-export ImagePicker for model plugins that render it directly
export { ImagePicker } from './impl/ImagePicker';
