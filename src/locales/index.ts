import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// English namespaces
import commonEn from './en/common.json';
import canvasEn from './en/canvas.json';
import inspectorEn from './en/inspector.json';
import recipeEn from './en/recipe.json';
import nodesEn from './en/nodes.json';
import widgetsEn from './en/widgets.json';
import modelsEn from './en/models.json';
import settingsEn from './en/settings.json';
import errorsEn from './en/errors.json';

// Chinese namespaces
import commonZh from './zh/common.json';
import canvasZh from './zh/canvas.json';
import inspectorZh from './zh/inspector.json';
import recipeZh from './zh/recipe.json';
import nodesZh from './zh/nodes.json';
import widgetsZh from './zh/widgets.json';
import modelsZh from './zh/models.json';
import settingsZh from './zh/settings.json';
import errorsZh from './zh/errors.json';

export const defaultNS = 'common';
export const namespaces = [
    'common',
    'canvas',
    'inspector',
    'recipe',
    'nodes',
    'widgets',
    'models',
    'settings',
    'errors',
] as const;

export type Namespace = (typeof namespaces)[number];

const resources = {
    en: {
        common: commonEn,
        canvas: canvasEn,
        inspector: inspectorEn,
        recipe: recipeEn,
        nodes: nodesEn,
        widgets: widgetsEn,
        models: modelsEn,
        settings: settingsEn,
        errors: errorsEn,
    },
    zh: {
        common: commonZh,
        canvas: canvasZh,
        inspector: inspectorZh,
        recipe: recipeZh,
        nodes: nodesZh,
        widgets: widgetsZh,
        models: modelsZh,
        settings: settingsZh,
        errors: errorsZh,
    },
} as const;

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'en',
        defaultNS,
        ns: namespaces,
        debug: import.meta.env.DEV,

        interpolation: {
            escapeValue: false,
        },

        detection: {
            order: ['localStorage', 'navigator'],
            caches: ['localStorage'],
        },
    });

export default i18n;
