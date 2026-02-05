// Call Default LLM - Pure async function
// For use in non-React contexts (autoGenerate, etc.)

import { modelRegistry, ModelPlugin, ModelExecutionResult, ProviderType } from '../index';
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
export async function callDefaultLLM(options: CallDefaultLLMOptions): Promise<ModelExecutionResult> {
    const settings = await loadSettings();

    // 1. Determine model ID
    const modelId = options.modelId || getDefaultModel(settings, 'llm') || 'gpt-4o-mini';

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
): Promise<ModelExecutionResult> {
    // Get provider and credentials
    const providers = model.supportedProviders || [model.provider];
    const configuredProvider = providers.find(p => isProviderConfigured(settings, p as ProviderKey));

    if (!configuredProvider) {
        return {
            success: false,
            error: `No API key configured for ${model.name}. Please configure ${providers.join(' or ')} in Settings.`
        };
    }

    // Map parseAs to jsonMode for backward compatibility
    const jsonMode = options.jsonMode ?? (options.parseAs === 'json');

    // Support both prompt and userPrompt (backward compat)
    const promptText = options.prompt || options.userPrompt || '';

    // Use settings default params as fallback
    const defaultParams = settings.defaultLLMParams || {};

    // If model has custom execute (e.g., for image/video gen), use it
    if (model.execute) {
        const creds = getProviderCredentials(settings, configuredProvider as ProviderKey);
        return model.execute({
            prompt: promptText,
            userPrompt: promptText,
            systemPrompt: options.systemPrompt,
            temperature: options.temperature ?? defaultParams.temperature ?? (model as any).defaultTemperature ?? 0.7,
            maxTokens: options.maxTokens ?? defaultParams.maxTokens ?? 2048,
            jsonMode,
            credentials: { apiKey: creds?.apiKey, baseUrl: creds?.baseUrl },
            provider: configuredProvider as ProviderType,
        });
    }

    // Default: use backend execute_model_command for LLMs
    try {
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke<{
            success: boolean;
            error?: string;
            text?: string;
        }>('execute_model_command', {
            request: {
                provider: configuredProvider,
                modelId: model.id,
                prompt: promptText,
                systemPrompt: options.systemPrompt,
            }
        });

        if (!result.success) {
            return { success: false, error: result.error || 'Backend execution failed' };
        }

        const responseText = result.text || '';

        if (jsonMode) {
            // Try to parse JSON from response
            try {
                const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                    responseText.match(/```\s*([\s\S]*?)\s*```/);
                const jsonStr = jsonMatch ? jsonMatch[1] : responseText;
                const data = JSON.parse(jsonStr);
                return { success: true, text: responseText, data };
            } catch {
                return { success: false, text: responseText, error: 'Failed to parse JSON' };
            }
        }

        return { success: true, text: responseText };
    } catch (error: any) {
        console.error(`[callDefaultLLM] Backend call failed:`, error);
        return { success: false, error: error.message || 'Backend call failed' };
    }
}

// Legacy alias for backward compatibility
export const callLLM = callDefaultLLM;

