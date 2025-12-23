// Widget Services Context
// Provides dependency injection for widgets that need access to model registries

import { createContext, useContext, ReactNode } from 'react';
import {
    getAllLLMModels as defaultGetAllLLMModels,
    getLLMModel as defaultGetLLMModel,
    getLLMModelsForCapability as defaultGetLLMModelsForCapability,
    LLMModelDefinition,
    LLMCapability,
} from '@features/models';
import {
    getModel as defaultGetModel,
    getModelsForCategory as defaultGetModelsForCategory,
    ModelPlugin,
    ModelCategory,
} from '@features/models';

// ============================================================================
// Service Types
// ============================================================================

export interface WidgetServices {
    // LLM services
    getAllLLMModels: () => LLMModelDefinition[];
    getLLMModel: (id: string) => LLMModelDefinition | undefined;
    getLLMModelsForCapability: (capability: LLMCapability) => LLMModelDefinition[];

    // Media model services
    getModel: (id: string) => ModelPlugin | undefined;
    getModelsForCategory: (category: ModelCategory) => ModelPlugin[];
}

// ============================================================================
// Default Services (production)
// ============================================================================

const defaultServices: WidgetServices = {
    getAllLLMModels: defaultGetAllLLMModels,
    getLLMModel: defaultGetLLMModel,
    getLLMModelsForCapability: defaultGetLLMModelsForCapability,
    getModel: defaultGetModel,
    getModelsForCategory: defaultGetModelsForCategory,
};

// ============================================================================
// Context
// ============================================================================

const WidgetServicesContext = createContext<WidgetServices>(defaultServices);

/**
 * Hook to access widget services
 * Use this instead of direct imports for testability
 */
export const useWidgetServices = (): WidgetServices => {
    return useContext(WidgetServicesContext);
};

// ============================================================================
// Provider Component
// ============================================================================

interface WidgetServicesProviderProps {
    children: ReactNode;
    services?: Partial<WidgetServices>;
}

/**
 * Provider for widget services
 * Wrap your app or test with this to inject custom services
 */
export function WidgetServicesProvider({
    children,
    services,
}: WidgetServicesProviderProps) {
    const mergedServices = { ...defaultServices, ...services };

    return (
        <WidgetServicesContext.Provider value={mergedServices}>
            {children}
        </WidgetServicesContext.Provider>
    );
}

// Re-export types for convenience
export type { LLMModelDefinition, LLMCapability, ModelPlugin, ModelCategory };
