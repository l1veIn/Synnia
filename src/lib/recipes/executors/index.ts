import {
    ExecutionContext,
    ExecutionResult,
    RecipeExecutor,
    ExecutorConfig,
    TemplateExecutorConfig,
    ExpressionExecutorConfig,
    HttpExecutorConfig,
    LlmAgentExecutorConfig,
} from '@/types/recipe';
import { invoke } from '@tauri-apps/api/core';
import { NodeType } from '@/types/project';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract text value from potentially wrapped input
 */
const extractValue = (v: any): any => {
    if (typeof v === 'object' && v !== null) {
        if (v.content !== undefined) return v.content;
        if (v.value !== undefined) return v.value;
    }
    return v;
};

/**
 * Extract text specifically
 */
const extractText = (v: any): string => String(extractValue(v) ?? '');

/**
 * Extract number specifically
 */
const extractNumber = (v: any): number => Number(extractValue(v) ?? 0);

/**
 * Simple template interpolation: {{key}} -> value
 */
const interpolate = (template: string, values: Record<string, any>): string => {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        const val = values[key];
        return val !== undefined ? extractText(val) : '';
    });
};

// ============================================================================
// Template Executor
// ============================================================================

const createTemplateExecutor = (config: TemplateExecutorConfig): RecipeExecutor => {
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

// ============================================================================
// Expression Executor
// ============================================================================

const createExpressionExecutor = (config: ExpressionExecutorConfig): RecipeExecutor => {
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

// ============================================================================
// HTTP Executor
// ============================================================================

const createHttpExecutor = (config: HttpExecutorConfig): RecipeExecutor => {
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

// ============================================================================
// LLM Agent Executor
// ============================================================================

const createLlmAgentExecutor = (config: LlmAgentExecutorConfig): RecipeExecutor => {
    return async (ctx: ExecutionContext): Promise<ExecutionResult> => {
        const { inputs, manifest } = ctx;

        try {
            // Get API settings
            const apiKey = await invoke<string>('get_api_key');
            const baseUrl = await invoke<string>('get_base_url').catch(() => 'https://generativelanguage.googleapis.com');
            const modelName = await invoke<string>('get_model_name').catch(() => 'gemini-1.5-flash');

            if (!apiKey) {
                return { success: false, error: 'API key not configured' };
            }

            // Build prompts from template
            const systemPrompt = config.systemPrompt
                ? interpolate(config.systemPrompt, inputs)
                : '';
            const userPrompt = interpolate(config.userPromptTemplate, inputs);

            if (!userPrompt.trim()) {
                return { success: false, error: 'User prompt is empty' };
            }

            // Build Gemini API request
            const url = `${baseUrl}/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

            const contents: any[] = [];
            if (systemPrompt.trim()) {
                contents.push({ role: 'user', parts: [{ text: `System: ${systemPrompt}` }] });
                contents.push({ role: 'model', parts: [{ text: 'Understood.' }] });
            }
            contents.push({ role: 'user', parts: [{ text: userPrompt }] });

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents,
                    generationConfig: {
                        temperature: config.temperature ?? inputs.temperature ?? 0.7,
                        maxOutputTokens: config.maxTokens ?? inputs.maxTokens ?? 2048
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return { success: false, error: errorData?.error?.message || `API error: ${response.status}` };
            }

            const data = await response.json();
            const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

            // Parse response if needed
            let parsedData: any = { response: responseText };

            if (config.parseAs === 'json') {
                try {
                    // Try to extract JSON from markdown code blocks
                    let jsonText = responseText;
                    const jsonBlockMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
                    if (jsonBlockMatch) {
                        jsonText = jsonBlockMatch[1];
                    } else {
                        const arrayMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
                        if (arrayMatch) jsonText = arrayMatch[0];
                    }
                    parsedData = JSON.parse(jsonText);
                } catch {
                    // Keep raw response if JSON parse fails
                    parsedData = { response: responseText };
                }
            }

            // Create nodes if configured
            const result: ExecutionResult = { success: true, data: parsedData };

            if (config.createNodes && Array.isArray(parsedData)) {
                const nodeType = config.nodeConfig?.type || NodeType.JSON;

                result.createNodes = parsedData.map((item: any, index: number) => {
                    const title = config.nodeConfig?.titleTemplate
                        ? interpolate(config.nodeConfig.titleTemplate, { ...item, index: index + 1 })
                        : `#${index + 1}`;

                    return {
                        type: nodeType,
                        data: {
                            title,
                            collapsed: config.nodeConfig?.collapsed ?? true,
                            assetType: 'json' as const,
                            content: {
                                schema: Object.keys(item).map(key => ({
                                    id: key,
                                    key,
                                    label: key.charAt(0).toUpperCase() + key.slice(1),
                                    type: 'string' as const
                                })),
                                values: item
                            }
                        },
                        position: index === 0 ? 'below' as const : undefined,
                        dockedTo: index > 0 ? '$prev' as const : undefined,
                    };
                });
            }

            return result;
        } catch (error: any) {
            return { success: false, error: error.message || 'LLM call failed' };
        }
    };
};

// ============================================================================
// Executor Factory
// ============================================================================

/**
 * Create an executor function from config
 */
export const createExecutor = (config: ExecutorConfig): RecipeExecutor => {
    switch (config.type) {
        case 'template':
            return createTemplateExecutor(config);
        case 'expression':
            return createExpressionExecutor(config);
        case 'http':
            return createHttpExecutor(config);
        case 'llm-agent':
            return createLlmAgentExecutor(config);
        case 'custom':
            // Custom executors are loaded separately
            throw new Error('Custom executors should be loaded via dynamic import');
        default:
            throw new Error(`Unknown executor type: ${(config as any).type}`);
    }
};

export { interpolate, extractValue, extractText, extractNumber };
