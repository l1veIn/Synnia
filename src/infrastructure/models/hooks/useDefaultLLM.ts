// useDefaultLLM - React hook for calling default LLM
// Provides React-aware state management around callDefaultLLM

import { useState, useCallback, useMemo } from 'react';
import { useSettings, isProviderConfigured, getDefaultModel, ProviderKey } from '@/lib/settings';
import { modelRegistry, ModelPlugin, ModelExecutionResult } from '../index';
import { callDefaultLLM, CallDefaultLLMOptions } from '../shared/callDefaultLLM';

export interface UseDefaultLLMOptions {
    // Override default model category (default: 'llm')
    category?: string;
}

export interface UseDefaultLLMReturn {
    // Call the default LLM
    call: (prompt: string, options?: Partial<Omit<CallDefaultLLMOptions, 'prompt'>>) => Promise<ModelExecutionResult>;

    // State
    isLoading: boolean;
    lastResult: ModelExecutionResult | null;
    lastError: string | null;

    // Model info
    isReady: boolean;
    defaultModel: ModelPlugin | null;
    defaultModelId: string | null;
}

/**
 * React hook for calling the default LLM with settings-aware credentials.
 */
export function useDefaultLLM(options: UseDefaultLLMOptions = {}): UseDefaultLLMReturn {
    const { category = 'llm' } = options;
    const { settings } = useSettings();

    const [isLoading, setIsLoading] = useState(false);
    const [lastResult, setLastResult] = useState<ModelExecutionResult | null>(null);
    const [lastError, setLastError] = useState<string | null>(null);

    // Get default model info
    const { defaultModelId, defaultModel, isReady } = useMemo(() => {
        if (!settings) {
            return { defaultModelId: null, defaultModel: null, isReady: false };
        }

        const modelId = getDefaultModel(settings, category) || getDefaultModel(settings, 'llm') || 'gpt-4o-mini';
        const model = modelRegistry.get(modelId);

        if (!model) {
            return { defaultModelId: modelId, defaultModel: null, isReady: false };
        }

        // Check if provider is configured
        const providers = model.supportedProviders || [model.provider];
        const hasConfiguredProvider = providers.some(p => isProviderConfigured(settings, p as ProviderKey));

        return {
            defaultModelId: modelId,
            defaultModel: model,
            isReady: hasConfiguredProvider
        };
    }, [settings, category]);

    // Call function
    const call = useCallback(async (
        prompt: string,
        callOptions?: Partial<Omit<CallDefaultLLMOptions, 'prompt'>>
    ): Promise<ModelExecutionResult> => {
        setIsLoading(true);
        setLastError(null);

        try {
            const result = await callDefaultLLM({
                prompt,
                modelId: defaultModelId || undefined,
                ...callOptions,
            });

            setLastResult(result);
            if (!result.success) {
                setLastError(result.error || 'Unknown error');
            }
            return result;
        } catch (error: any) {
            const errorMessage = error.message || 'LLM call failed';
            setLastError(errorMessage);
            const result: ModelExecutionResult = { success: false, error: errorMessage };
            setLastResult(result);
            return result;
        } finally {
            setIsLoading(false);
        }
    }, [defaultModelId]);

    return {
        call,
        isLoading,
        lastResult,
        lastError,
        isReady,
        defaultModel,
        defaultModelId,
    };
}
