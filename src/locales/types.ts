/**
 * TypeScript type declarations for i18n resources.
 * Provides type safety and IDE autocompletion for translation keys.
 */
import type commonEn from './en/common.json';
import type canvasEn from './en/canvas.json';
import type inspectorEn from './en/inspector.json';
import type recipeEn from './en/recipe.json';
import type nodesEn from './en/nodes.json';
import type widgetsEn from './en/widgets.json';
import type modelsEn from './en/models.json';
import type settingsEn from './en/settings.json';
import type errorsEn from './en/errors.json';

declare module 'i18next' {
    interface CustomTypeOptions {
        defaultNS: 'common';
        resources: {
            common: typeof commonEn;
            canvas: typeof canvasEn;
            inspector: typeof inspectorEn;
            recipe: typeof recipeEn;
            nodes: typeof nodesEn;
            widgets: typeof widgetsEn;
            models: typeof modelsEn;
            settings: typeof settingsEn;
            errors: typeof errorsEn;
        };
    }
}
