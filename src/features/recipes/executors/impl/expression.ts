// ============================================================================
// Expression Executor
// JavaScript expression evaluation with safe context
// ============================================================================

import {
    ExecutionContext,
    ExecutionResult,
    RecipeExecutor,
    ExecutorConfig,
} from '@/types/recipe';
import { extractValue } from '../utils';

// Executor-specific configuration
export interface ExpressionExecutorConfig extends ExecutorConfig {
    type: 'expression';
    expression: string;
    outputKey?: string;
}

export const createExecutor = (config: ExpressionExecutorConfig): RecipeExecutor => {
    return async (ctx: ExecutionContext): Promise<ExecutionResult> => {
        const { inputs } = ctx;
        const outputKey = config.outputKey || 'result';

        try {
            // Create a safe evaluation context
            const evalContext: Record<string, any> = {};
            for (const [key, value] of Object.entries(inputs)) {
                evalContext[key] = extractValue(value);
            }

            // Create function with inputs as arguments
            const fn = new Function(...Object.keys(evalContext), `return (${config.expression})`);
            const result = fn(...Object.values(evalContext));

            return {
                success: true,
                data: { [outputKey]: result }
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message || 'Expression evaluation failed'
            };
        }
    };
};
