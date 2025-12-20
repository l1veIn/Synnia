// ============================================================================
// Template Executor
// Simple string interpolation with {{key}} syntax
// ============================================================================

import {
    ExecutionContext,
    ExecutionResult,
    RecipeExecutor,
    ExecutorConfig,
} from '@/types/recipe';
import { interpolate } from '../utils';

// Executor-specific configuration
export interface TemplateExecutorConfig extends ExecutorConfig {
    type: 'template';
    template: string;
    outputKey?: string;
}

export const createExecutor = (config: TemplateExecutorConfig): RecipeExecutor => {
    return async (ctx: ExecutionContext): Promise<ExecutionResult> => {
        const { inputs } = ctx;
        const outputKey = config.outputKey || 'result';

        try {
            const result = interpolate(config.template, inputs);
            return {
                success: true,
                data: { [outputKey]: result }
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message || 'Template interpolation failed'
            };
        }
    };
};
