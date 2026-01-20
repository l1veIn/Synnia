// Call Default LLM - Pure async function
// For use in non-React contexts (autoGenerate, etc.)

import { modelRegistry, ModelPlugin, LLMExecutionResult, ProviderCredentials, ProviderType } from '../index';
import { loadSettings, getProviderCredentials, getDefaultModel, isProviderConfigured, ProviderKey } from '@/lib/settings';

export interface CallDefaultLLMOptions {
    // Prompt (use either prompt or userPrompt)
    prompt?: string;
    userPrompt?: string;  // Alias for prompt (backward compatibility)
    systemPrompt?: string;

    // Model override (optional, defaults to settings)
    modelId?: string;

    // Generation params
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;

    // Legacy compatibility
    parseAs?: 'text' | 'json';

    // Provider override (optional)
    providerId?: string;
}

/**
 * Call the default LLM configured in Settings.
 * Uses modelRegistry (unified) instead of legacy llmRegistry.
 */
export async function callDefaultLLM(options: CallDefaultLLMOptions): Promise<LLMExecutionResult> {
    const settings = await loadSettings();

    // 1. Determine model ID
    const modelId = options.modelId || getDefaultModel(settings, 'llm-chat') || getDefaultModel(settings, 'llm') || 'gpt-4o-mini';

    // 2. Get model from unified registry
    const model = modelRegistry.get(modelId);
    if (!model) {
        // Try to find any configured LLM as fallback
        const llmModels = modelRegistry.getByCategory('llm');
        const fallback = llmModels.find(m => {
            const providers = m.supportedProviders || [m.provider];
            return providers.some(p => isProviderConfigured(settings, p as ProviderKey));
        });

        if (fallback) {
            console.warn(`[CallDefaultLLM] Model "${modelId}" not found, using fallback: ${fallback.id}`);
            return executeWithModel(fallback, options, settings);
        }

        return {
            success: false,
            error: `Model "${modelId}" not found. Available LLMs: ${llmModels.map(m => m.id).join(', ')}`
        };
    }

    return executeWithModel(model, options, settings);
}

async function executeWithModel(
    model: ModelPlugin,
    options: CallDefaultLLMOptions,
    settings: Awaited<ReturnType<typeof loadSettings>>
): Promise<LLMExecutionResult> {
    // Get provider and credentials
    const providers = model.supportedProviders || [model.provider];
    const configuredProvider = providers.find(p => isProviderConfigured(settings, p as ProviderKey));

    if (!configuredProvider) {
        return {
            success: false,
            error: `No API key configured for ${model.name}. Please configure ${providers.join(' or ')} in Settings.`
        };
    }

    const creds = getProviderCredentials(settings, configuredProvider as ProviderKey);
    const credentials: ProviderCredentials = {
        apiKey: creds?.apiKey,
        baseUrl: creds?.baseUrl,
    };

    // Map parseAs to jsonMode for backward compatibility
    const jsonMode = options.jsonMode ?? (options.parseAs === 'json');

    // Support both prompt and userPrompt (backward compat)
    const promptText = options.prompt || options.userPrompt || '';

    // Use settings default params as fallback
    const defaultParams = settings.defaultLLMParams || {};

    return model.execute({
        prompt: promptText,
        userPrompt: promptText,
        systemPrompt: options.systemPrompt,
        temperature: options.temperature ?? defaultParams.temperature ?? (model as any).defaultTemperature ?? 0.7,
        maxTokens: options.maxTokens ?? defaultParams.maxTokens ?? 2048,
        jsonMode,
        credentials,
        provider: configuredProvider as ProviderType,
    });
}

// Legacy alias for backward compatibility
export const callLLM = callDefaultLLM;
