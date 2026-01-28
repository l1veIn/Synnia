// Http Executor
// Executes HTTP requests based on recipe configuration
// Supports template variables for URL, headers, and body

import { ExecutionContext, ExecutionResult, RecipeManifest } from '@/types/recipe';
import { Executor } from '../types';
import { invoke } from '@tauri-apps/api/core';

// ============================================================================
// Http Config Types (local - extends recipe.ts HttpExecutorConfig)
// ============================================================================

interface LocalHttpConfig {
    type: 'http';
    url?: string;           // Our extended field
    endpoint?: string;      // From recipe.ts HttpExecutorConfig
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    headers?: Record<string, string>;
    body?: string | object;
    timeout?: number;
    useProxy?: boolean;     // Use Tauri backend proxy
}

// Tauri proxy response type
interface ProxyResponse {
    status: number;
    headers: Record<string, string>;
    body: string;
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
        // manifest.executor is the config itself
        const config = manifest.executor as unknown as LocalHttpConfig | undefined;

        // Support both 'url' (extended) and 'endpoint' (recipe.ts type)
        const baseUrl = config?.url || config?.endpoint;

        // 1. Validate config
        if (!baseUrl) {
            return { success: false, error: 'HTTP executor requires url or endpoint in config' };
        }

        try {
            // 2. Build request
            const url = interpolateTemplate(baseUrl, inputs);
            const method = config?.method || 'POST';
            const headers = interpolateHeaders(config?.headers || {}, inputs);

            // 3. Build body
            let body: string | undefined;
            if (config?.body) {
                if (typeof config.body === 'string') {
                    body = interpolateTemplate(config.body, inputs);
                } else {
                    body = interpolateTemplate(JSON.stringify(config.body), inputs);
                }
            }

            // 4. Choose request method based on useProxy
            if (config?.useProxy) {
                return await executeViaProxy(url, method, headers, body);
            } else {
                return await executeViaFetch(url, method, headers, body);
            }

        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'HTTP request failed';
            return {
                success: false,
                error: message,
            };
        }
    }
};

// ============================================================================
// Request Execution Methods
// ============================================================================

/**
 * Execute via browser fetch API (default)
 */
async function executeViaFetch(
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: string
): Promise<ExecutionResult> {
    const response = await fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
        body: method !== 'GET' ? body : undefined,
    });

    const contentType = response.headers.get('content-type') || '';
    let data: unknown;

    if (contentType.includes('application/json')) {
        data = await response.json();
    } else {
        data = await response.text();
    }

    if (!response.ok) {
        return {
            success: false,
            error: `HTTP ${response.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`,
        };
    }

    return { success: true, data };
}

/**
 * Execute via Tauri backend proxy (bypasses CORS)
 */
async function executeViaProxy(
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: string
): Promise<ExecutionResult> {
    const proxyResponse = await invoke<ProxyResponse>('proxy_request', {
        url,
        method,
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
        body: method !== 'GET' ? body : null,
    });

    const contentType = proxyResponse.headers['content-type'] || '';
    let data: unknown;

    if (contentType.includes('application/json')) {
        try {
            data = JSON.parse(proxyResponse.body);
        } catch {
            data = proxyResponse.body;
        }
    } else {
        data = proxyResponse.body;
    }

    if (proxyResponse.status >= 400) {
        return {
            success: false,
            error: `HTTP ${proxyResponse.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`,
        };
    }

    return { success: true, data };
}

// ============================================================================
// Template Utilities
// ============================================================================

/**
 * Interpolate template with {{input.xxx}} or {{xxx}} syntax
 */
function interpolateTemplate(template: string, inputs: Record<string, unknown>): string {
    return template.replace(/\{\{(input\.)?([\w.]+)\}\}/g, (_, _prefix, key) => {
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
    inputs: Record<string, unknown>
): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
        result[key] = interpolateTemplate(value, inputs);
    }
    return result;
}
