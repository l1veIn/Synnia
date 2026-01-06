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
import { FormInputWidget } from './impl/FormInput';
import { TableInputWidget } from './impl/TableInput';
import { AspectRatioSelectorWidget } from './impl/AspectRatioSelector';
import { ColorPickerWidget } from './impl/ColorPicker';
import { SliderWidget } from './impl/Slider';
import { SwitchWidget } from './impl/Switch';
import { SelectWidget } from './impl/Select';
import { SegmentedWidget } from './impl/Segmented';
import { TagsWidget } from './impl/Tags';
import { NumberWidget } from './impl/Number';

// Register all widgets
widgetRegistry.register(ImagePickerWidget);
widgetRegistry.register(TextInputWidget);
widgetRegistry.register(TextAreaWidget);
widgetRegistry.register(FormInputWidget);
widgetRegistry.register(TableInputWidget);
widgetRegistry.register(AspectRatioSelectorWidget);
widgetRegistry.register(ColorPickerWidget);
widgetRegistry.register(SliderWidget);
widgetRegistry.register(SwitchWidget);
widgetRegistry.register(SelectWidget);
widgetRegistry.register(SegmentedWidget);
widgetRegistry.register(TagsWidget);
widgetRegistry.register(NumberWidget);

// Re-export ImagePicker for model plugins that render it directly
export { ImagePicker } from './impl/ImagePicker';
