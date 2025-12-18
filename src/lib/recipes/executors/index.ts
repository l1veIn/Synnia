import {
    ExecutionContext,
    ExecutionResult,
    RecipeExecutor,
    ExecutorConfig,
    TemplateExecutorConfig,
    ExpressionExecutorConfig,
    HttpExecutorConfig,
    LlmAgentExecutorConfig,
    MediaExecutorConfig,
} from '@/types/recipe';
import { invoke } from '@tauri-apps/api/core';
import { NodeType } from '@/types/project';
import { generateImages, getDefaultImageProvider } from '@/lib/services/media';

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

/**
 * Attempt to repair a truncated JSON array
 * Tries to close open objects and arrays to salvage partial data
 */
const repairTruncatedJsonArray = (jsonText: string): string | null => {
    let text = jsonText.trim();

    // Must start with [
    if (!text.startsWith('[')) return null;

    // If already valid, return as-is
    try {
        JSON.parse(text);
        return text;
    } catch { }

    // Try to find the last complete object
    const lastCompleteObject = text.lastIndexOf('}');
    if (lastCompleteObject === -1) return null;

    // Truncate after the last complete object and close the array
    text = text.substring(0, lastCompleteObject + 1);

    // Remove trailing comma if present
    text = text.replace(/,\s*$/, '');

    // Close the array
    text = text + ']';

    // Validate the repaired JSON
    try {
        JSON.parse(text);
        return text;
    } catch {
        return null;
    }
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
            // Build prompts from template
            const systemPrompt = config.systemPrompt
                ? interpolate(config.systemPrompt, inputs)
                : '';
            const userPrompt = interpolate(config.userPromptTemplate, inputs);

            if (!userPrompt.trim()) {
                return { success: false, error: 'User prompt is empty' };
            }

            // Use new AI service for LLM call
            const { callLLM } = await import('@/lib/services/ai');
            const response = await callLLM({
                systemPrompt: systemPrompt || undefined,
                userPrompt,
                temperature: config.temperature ?? inputs.temperature ?? 0.7,
                maxTokens: config.maxTokens ?? inputs.maxTokens ?? 2048,
                parseAs: config.parseAs === 'json' ? 'json' : 'text',
                // Support per-node provider override
                providerId: inputs._aiProviderId || undefined,
            });

            if (!response.success) {
                return { success: false, error: response.error || 'LLM call failed' };
            }

            const responseText = response.text || '';
            const wasTruncated = response.wasTruncated || false;

            if (wasTruncated) {
                console.warn('[LLM-Agent] Response was truncated due to token limit. Consider increasing maxTokens.');
            }

            // Use parsed data from AI service if JSON mode, otherwise use text
            let parsedData: any = config.parseAs === 'json' && response.data
                ? response.data
                : responseText;

            // Create nodes if configured
            const result: ExecutionResult = { success: true, data: parsedData };

            console.log('[LLM-Agent] createNodes:', config.createNodes, 'isArray:', Array.isArray(parsedData));
            if (config.createNodes && Array.isArray(parsedData)) {
                const nodeConfigType = config.nodeConfig?.type || 'json';

                // Determine node type to create
                const resolveNodeType = (t: string): NodeType => {
                    switch (t) {
                        case 'selector': return NodeType.SELECTOR;
                        case 'table': return NodeType.TABLE;
                        case 'gallery': return NodeType.GALLERY;
                        case 'json':
                        case 'auto':
                        default:
                            return NodeType.JSON;
                    }
                };

                // Build schema from config or auto-infer
                const buildSchema = (item: any) => {
                    if (config.nodeConfig?.schema && config.nodeConfig.schema !== 'auto') {
                        // Use explicit schema
                        return config.nodeConfig.schema.map((f: any) => ({
                            id: f.key,
                            key: f.key,
                            label: f.label || f.key,
                            type: f.type || 'string'
                        }));
                    }
                    // Auto-infer from data
                    return Object.keys(item).map(key => ({
                        id: key,
                        key,
                        label: key.charAt(0).toUpperCase() + key.slice(1),
                        type: 'string' as const
                    }));
                };

                // Handle Selector: create ONE node with all items as options
                if (nodeConfigType === 'selector') {
                    const schema = buildSchema(parsedData[0] || {});
                    const options = parsedData.map((item: any, idx: number) => ({
                        id: `opt-${idx}`,
                        ...item
                    }));

                    const title = config.nodeConfig?.titleTemplate
                        ? interpolate(config.nodeConfig.titleTemplate, { count: parsedData.length })
                        : `选择器 (${parsedData.length}项)`;

                    result.createNodes = [{
                        type: NodeType.SELECTOR,
                        data: {
                            title,
                            collapsed: config.nodeConfig?.collapsed ?? false,
                            assetType: 'json' as const,
                            content: {
                                mode: config.nodeConfig?.selectorMode || 'single',
                                showSearch: true,
                                optionSchema: schema,
                                options,
                                selected: []
                            }
                        },
                        position: 'below' as const,
                    }];
                }
                // Handle Table: create ONE node with all items as rows
                else if (nodeConfigType === 'table') {
                    const schema = buildSchema(parsedData[0] || {});
                    const title = config.nodeConfig?.titleTemplate
                        ? interpolate(config.nodeConfig.titleTemplate, { count: parsedData.length })
                        : `表格 (${parsedData.length}行)`;

                    result.createNodes = [{
                        type: NodeType.TABLE,
                        data: {
                            title,
                            collapsed: config.nodeConfig?.collapsed ?? false,
                            assetType: 'json' as const,
                            content: {
                                columns: schema,
                                rows: parsedData,
                                showRowNumbers: true,
                                allowAddRow: true,
                                allowDeleteRow: true,
                            }
                        },
                        position: 'below' as const,
                    }];
                }
                // Handle JSON/auto: create MULTIPLE nodes (one per item)
                else {
                    result.createNodes = parsedData.map((item: any, index: number) => {
                        const title = config.nodeConfig?.titleTemplate
                            ? interpolate(config.nodeConfig.titleTemplate, { ...item, index: index + 1 })
                            : `#${index + 1}`;

                        return {
                            type: resolveNodeType(nodeConfigType),
                            data: {
                                title,
                                collapsed: config.nodeConfig?.collapsed ?? true,
                                assetType: 'json' as const,
                                content: {
                                    schema: buildSchema(item),
                                    values: item
                                }
                            },
                            position: index === 0 ? 'below' as const : undefined,
                            dockedTo: index > 0 ? '$prev' as const : undefined,
                        };
                    });
                }
            }

            return result;
        } catch (error: any) {
            return { success: false, error: error.message || 'LLM call failed' };
        }
    };
};

// ============================================================================
// Media Executor (Simplified - uses Model Plugin System)
// ============================================================================

const createMediaExecutor = (config: MediaExecutorConfig): RecipeExecutor => {
    return async (ctx: ExecutionContext): Promise<ExecutionResult> => {
        const { inputs, node } = ctx;
        const { outputNode } = config;

        try {
            // Extract modelConfig from inputs
            const modelConfigValue = extractValue(inputs.modelConfig);
            if (!modelConfigValue?.modelId) {
                return { success: false, error: 'No model selected' };
            }

            // Get the model plugin
            const { getModel } = await import('@/lib/models');
            const modelPlugin = getModel(modelConfigValue.modelId);
            if (!modelPlugin) {
                return { success: false, error: `Model not found: ${modelConfigValue.modelId}` };
            }

            // Get credentials from settings
            const { getSettings, getProviderCredentials } = await import('@/lib/settings');
            const settings = getSettings();
            const provider = (modelConfigValue.provider || modelPlugin.supportedProviders[0]) as import('@/lib/settings/types').ProviderKey;
            const credentials = getProviderCredentials(settings, provider);

            if (!credentials?.apiKey && !credentials?.baseUrl) {
                return { success: false, error: `No credentials configured for ${provider}` };
            }

            // Execute via model plugin
            const prompt = extractText(inputs.prompt);
            const negativePrompt = inputs.negativePrompt ? extractText(inputs.negativePrompt) : undefined;
            const images = inputs.image ? [extractValue(inputs.image)] : undefined;

            const modelResult = await modelPlugin.execute({
                config: modelConfigValue.config,
                prompt,
                negativePrompt,
                images,
                credentials: {
                    apiKey: credentials.apiKey || '',
                    baseUrl: credentials.baseUrl,
                },
            });

            if (!modelResult.success) {
                return { success: false, error: modelResult.error };
            }

            // Handle output based on result type
            if (modelResult.data?.type === 'images' && modelResult.data.images) {
                const galleryImages = modelResult.data.images.map((img, idx) => ({
                    id: `gen-${Date.now()}-${idx}`,
                    src: img.url,
                    starred: false,
                    caption: `${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}`,
                }));

                const title = outputNode?.titleTemplate
                    ? interpolate(outputNode.titleTemplate, inputs)
                    : `Generated: ${prompt.slice(0, 30)}...`;

                return {
                    success: true,
                    data: modelResult.data.images,
                    createNodes: [{
                        type: NodeType.GALLERY,
                        data: {
                            label: title,
                            assetType: 'json' as const,
                            assetName: title,
                            content: {
                                viewMode: 'grid',
                                columnsPerRow: galleryImages.length > 2 ? 3 : galleryImages.length,
                                allowStar: true,
                                allowDelete: true,
                                images: galleryImages,
                            },
                        },
                        position: 'below',
                        dockedTo: node.id,
                    }],
                };
            }

            if (modelResult.data?.type === 'video' && modelResult.data.videoUrl) {
                const title = outputNode?.titleTemplate
                    ? interpolate(outputNode.titleTemplate, inputs)
                    : `Video: ${prompt.slice(0, 30)}...`;

                // TODO: Create video node when video node type is ready
                return {
                    success: true,
                    data: { videoUrl: modelResult.data.videoUrl },
                };
            }

            return { success: true, data: modelResult.data };
        } catch (error: any) {
            return { success: false, error: error.message || 'Media generation failed' };
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
        case 'media':
            return createMediaExecutor(config);
        case 'custom':
            // Custom executors are loaded separately
            throw new Error('Custom executors should be loaded via dynamic import');
        default:
            throw new Error(`Unknown executor type: ${(config as any).type}`);
    }
};

export { interpolate, extractValue, extractText, extractNumber };
