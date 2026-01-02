// Widget System - Entry Point
// Central registry for all workflow widgets

export * from './lib/types';
export * from './lib/registry';
export { RecipeFieldRow, RecipeFormRenderer } from './lib/FieldRow';

// ============================================================================
// Register Built-in Widgets
// ============================================================================

import { widgetRegistry } from './lib/registry';

// Self-contained widget definitions
import { ImagePickerWidget } from './impl/ImagePicker';
import { TextInputWidget } from './impl/TextInput';
import { TextAreaWidget } from './impl/TextArea';
import { JSONInputWidget } from './impl/JSONInput';
import { AspectRatioSelectorWidget } from './impl/AspectRatioSelector';
import { ColorPickerWidget } from './impl/ColorPicker';

// Register all widgets
widgetRegistry.register(ImagePickerWidget);
widgetRegistry.register(TextInputWidget);
widgetRegistry.register(TextAreaWidget);
widgetRegistry.register(JSONInputWidget);
widgetRegistry.register(AspectRatioSelectorWidget);
widgetRegistry.register(ColorPickerWidget);

// Re-export ImagePicker for model plugins that render it directly
export { ImagePicker } from './impl/ImagePicker';
