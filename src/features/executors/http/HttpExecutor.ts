// Http Executor
// Executes HTTP requests based on recipe configuration
// Supports template variables for URL, headers, and body

import { ExecutionContext, ExecutionResult, RecipeManifest } from '@/types/recipe';
import { Executor } from '../types';

// ============================================================================
// Http Config Types
// ============================================================================

interface HttpExecutorConfig {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    headers?: Record<string, string>;
    body?: string | object;
}

// ============================================================================
// Http Executor
// ============================================================================

export const HttpExecutor: Executor = {
    type: 'http',

    canHandle(manifest: RecipeManifest): boolean {
        return manifest.executor?.type === 'http';
    },

    async execute(ctx: ExecutionContext): Promise<ExecutionResult> {
        const { manifest, inputs } = ctx;
        const config = manifest.executor?.config as HttpExecutorConfig | undefined;

        // 1. Validate config
        if (!config?.url) {
            return { success: false, error: 'HTTP executor requires url in config' };
        }

        try {
            // 2. Build request
            const url = interpolateTemplate(config.url, inputs);
            const method = config.method || 'POST';
            const headers = interpolateHeaders(config.headers || {}, inputs);

            // 3. Build body
            let body: string | undefined;
            if (config.body) {
                if (typeof config.body === 'string') {
                    body = interpolateTemplate(config.body, inputs);
                } else {
                    body = interpolateTemplate(JSON.stringify(config.body), inputs);
                }
            }

            // 4. Send request
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...headers,
                },
                body: method !== 'GET' ? body : undefined,
            });

            // 5. Parse response
            const contentType = response.headers.get('content-type') || '';
            let data: any;

            if (contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }

            // 6. Check status
            if (!response.ok) {
                return {
                    success: false,
                    error: `HTTP ${response.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`,
                };
            }

            return { success: true, data };

        } catch (error: any) {
            return {
                success: false,
                error: error.message || 'HTTP request failed',
            };
        }
    }
};

// ============================================================================
// Template Utilities
// ============================================================================

/**
 * Interpolate template with {{input.xxx}} or {{xxx}} syntax
 */
function interpolateTemplate(template: string, inputs: Record<string, any>): string {
    return template.replace(/\{\{(input\.)?(\w+)\}\}/g, (_, prefix, key) => {
        const val = inputs[key];
        if (val === undefined) return '';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
    });
}

/**
 * Interpolate headers object with template values
 */
function interpolateHeaders(
    headers: Record<string, string>,
    inputs: Record<string, any>
): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
        result[key] = interpolateTemplate(value, inputs);
    }
    return result;
}
