// ModelConfigurator Widget Definition
// Declares dynamic input handles based on selected model capabilities

import { WidgetDefinition, HandleSpec } from '../types';
import { ModelConfigurator } from '@/components/workflow/inspector/widgets/ModelConfigurator';
import { getModel } from '@/lib/models';

/**
 * Get input handles based on model category and capabilities
 */
function getInputHandles(value: any): HandleSpec[] {
    if (!value?.modelId) return [];

    const model = getModel(value.modelId);
    if (!model) return [];

    const handles: HandleSpec[] = [];

    // Check model category for image-to-image support
    const supportsReferenceImage =
        model.category === 'image-to-image' ||
        model.category === 'reference-to-video' ||
        // Also check if config has referenceImage (model explicitly supports it)
        value?.config?.referenceImage !== undefined;

    if (supportsReferenceImage || model.category === 'text-to-image') {
        // Most image models support optional reference image
        handles.push({
            id: 'referenceImage',
            dataType: 'image',
            label: 'Reference Image',
        });
    }

    return handles;
}

export const modelConfiguratorWidget: WidgetDefinition = {
    id: 'model-configurator',
    render: (props) => <ModelConfigurator {...props} />,
    getInputHandles,
};
