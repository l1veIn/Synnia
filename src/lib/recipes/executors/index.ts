// ============================================================================
// Executor Registry - Entry Point (Auto-Discovery)
// Automatically discovers and registers all executors from impl/ directory
// ============================================================================

import { ExecutorConfig, RecipeExecutor } from '@/types/recipe';

// Re-export utils for external use
export { interpolate, extractValue, extractText, extractNumber } from './utils';

// ============================================================================
// Auto-Discovery via import.meta.glob
// Convention: file name = executor type, each file exports createExecutor
// ============================================================================

interface ExecutorModule {
    createExecutor: (config: any) => RecipeExecutor;
}

// Eagerly import all executor implementations
const executorModules = import.meta.glob<ExecutorModule>('./impl/*.ts', {
    eager: true
});

// Build executor factory registry from discovered modules
const executorFactories: Record<string, (config: any) => RecipeExecutor> = {};

for (const [path, module] of Object.entries(executorModules)) {
    // Extract type from path: ./impl/template.ts -> 'template'
    const match = path.match(/\.\/impl\/(.+)\.ts$/);
    if (match && module.createExecutor) {
        const type = match[1]; // e.g., 'template', 'llm-agent', 'media'
        executorFactories[type] = module.createExecutor;
        // console.log(`[ExecutorRegistry] Registered: ${type}`);
    }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Create an executor function from config
 * @param config Executor configuration with 'type' field matching an impl/ file name
 */
export const createExecutor = (config: ExecutorConfig): RecipeExecutor => {
    const factory = executorFactories[config.type];

    if (!factory) {
        if (config.type === 'custom') {
            throw new Error('Custom executors should be loaded via dynamic import');
        }
        throw new Error(`Unknown executor type: ${config.type}. Available: ${Object.keys(executorFactories).join(', ')}`);
    }

    return factory(config);
};

/**
 * Get all registered executor types
 */
export const getExecutorTypes = (): string[] => {
    return Object.keys(executorFactories);
};

/**
 * Register a custom executor factory at runtime
 * Useful for plugins or dynamic extensions
 */
export const registerExecutorFactory = (
    type: string,
    factory: (config: any) => RecipeExecutor
): void => {
    executorFactories[type] = factory;
};

/**
 * Check if an executor type is registered
 */
export const hasExecutorType = (type: string): boolean => {
    return type in executorFactories;
};
