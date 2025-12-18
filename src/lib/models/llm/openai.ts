// OpenAI LLM Plugins
// GPT-4o and GPT-4o-mini

import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { LLMPlugin, LLMExecutionInput, LLMExecutionResult } from '../types';
import { extractJson } from './utils';

// ============================================================================
// Shared OpenAI Execution Logic
// ============================================================================

async function executeOpenAI(
    input: LLMExecutionInput,
    modelId: string
): Promise<LLMExecutionResult> {
    const { credentials, systemPrompt, userPrompt, temperature, maxTokens, jsonMode } = input;

    if (!credentials.apiKey) {
        return { success: false, error: 'OpenAI API key not configured' };
    }

    try {
        const openai = createOpenAI({
            apiKey: credentials.apiKey,
            baseURL: credentials.baseUrl || 'https://api.openai.com/v1',
        });

        const model = openai(modelId);

        // Build prompt
        let prompt = userPrompt;
        if (systemPrompt) {
            prompt = `System: ${systemPrompt}\n\nUser: ${userPrompt}`;
        }

        const result = await generateText({
            model,
            prompt,
            temperature: temperature ?? 0.7,
            maxOutputTokens: maxTokens ?? 2048,
        });

        const responseText = result.text;
        const wasTruncated = result.finishReason === 'length';

        if (jsonMode) {
            const { data, success } = extractJson(responseText);
            if (success) {
                return { success: true, text: responseText, data, wasTruncated };
            } else {
                return {
                    success: false,
                    text: responseText,
                    error: 'Failed to parse JSON from response',
                    wasTruncated,
                };
            }
        }

        return { success: true, text: responseText, wasTruncated };
    } catch (error: any) {
        console.error('[OpenAI] Call failed:', error);
        return { success: false, error: error.message || 'OpenAI call failed' };
    }
}

// ============================================================================
// GPT-4o Plugin
// ============================================================================

export const gpt4o: LLMPlugin = {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'Most capable GPT-4 model with vision support',
    category: 'llm-vision',
    supportedProviders: ['openai'],
    provider: 'openai',
    capabilities: ['chat', 'vision', 'function-calling', 'json-mode', 'streaming'],
    contextWindow: 128000,
    maxOutputTokens: 16384,
    defaultTemperature: 0.7,
    execute: (input) => executeOpenAI(input, 'gpt-4o'),
};

// ============================================================================
// GPT-4o-mini Plugin
// ============================================================================

export const gpt4oMini: LLMPlugin = {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Fast and affordable GPT-4o variant',
    category: 'llm-chat',
    supportedProviders: ['openai'],
    provider: 'openai',
    capabilities: ['chat', 'vision', 'function-calling', 'json-mode', 'streaming'],
    contextWindow: 128000,
    maxOutputTokens: 16384,
    defaultTemperature: 0.7,
    execute: (input) => executeOpenAI(input, 'gpt-4o-mini'),
};
