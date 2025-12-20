// ============================================================================
// HTTP Executor
// Fetch-based HTTP request executor with template interpolation
// ============================================================================

import {
    ExecutionContext,
    ExecutionResult,
    RecipeExecutor,
    ExecutorConfig,
} from '@/types/recipe';
import { interpolate } from '../utils';

// Executor-specific configuration
export interface HttpExecutorConfig extends ExecutorConfig {
    type: 'http';
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    body?: string;
    responseType?: 'json' | 'text';
    outputKey?: string;
}

export const createExecutor = (config: HttpExecutorConfig): RecipeExecutor => {
    return async (ctx: ExecutionContext): Promise<ExecutionResult> => {
        const { inputs } = ctx;
        const outputKey = config.outputKey || 'response';

        try {
            const url = interpolate(config.url, inputs);
            const method = config.method || 'GET';

            const headers: Record<string, string> = {};
            if (config.headers) {
                for (const [key, value] of Object.entries(config.headers)) {
                    headers[key] = interpolate(value, inputs);
                }
            }

            const fetchOptions: RequestInit = {
                method,
                headers,
            };

            if (config.body && method !== 'GET') {
                fetchOptions.body = interpolate(config.body, inputs);
                if (!headers['Content-Type']) {
                    headers['Content-Type'] = 'application/json';
                }
            }

            const response = await fetch(url, fetchOptions);

            if (!response.ok) {
                return {
                    success: false,
                    error: `HTTP ${response.status}: ${response.statusText}`
                };
            }

            const data = config.responseType === 'text'
                ? await response.text()
                : await response.json();

            return {
                success: true,
                data: { [outputKey]: data }
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message || 'HTTP request failed'
            };
        }
    };
};
