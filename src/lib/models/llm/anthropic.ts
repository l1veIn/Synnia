// Anthropic Claude LLM Plugins

import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { LLMPlugin, LLMExecutionInput, LLMExecutionResult } from '../types';
import { extractJson } from './utils';

// ============================================================================
// Shared Anthropic Execution Logic
// ============================================================================

async function executeAnthropic(
    input: LLMExecutionInput,
    modelId: string
): Promise<LLMExecutionResult> {
    const { credentials, systemPrompt, userPrompt, temperature, maxTokens, jsonMode } = input;

    if (!credentials.apiKey) {
        return { success: false, error: 'Anthropic API key not configured' };
    }

    try {
        const anthropic = createAnthropic({
            apiKey: credentials.apiKey,
            baseURL: credentials.baseUrl || 'https://api.anthropic.com',
        });

        const model = anthropic(modelId);

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
                return { success: false, text: responseText, error: 'Failed to parse JSON', wasTruncated };
            }
        }

        return { success: true, text: responseText, wasTruncated };
    } catch (error: any) {
        console.error('[Anthropic] Call failed:', error);
        return { success: false, error: error.message || 'Anthropic call failed' };
    }
}

// ============================================================================
// Claude 3.5 Sonnet Plugin
// ============================================================================

export const claude35Sonnet: LLMPlugin = {
    id: 'claude-3-5-sonnet-latest',
    name: 'Claude 3.5 Sonnet',
    description: 'Most intelligent Claude model',
    category: 'llm-vision',
    supportedProviders: ['anthropic'],
    provider: 'anthropic',
    capabilities: ['chat', 'vision', 'function-calling', 'json-mode', 'streaming'],
    contextWindow: 200000,
    maxOutputTokens: 8192,
    defaultTemperature: 0.7,
    execute: (input) => executeAnthropic(input, 'claude-3-5-sonnet-latest'),
};

// ============================================================================
// Claude 3.5 Haiku Plugin
// ============================================================================

export const claude35Haiku: LLMPlugin = {
    id: 'claude-3-5-haiku-latest',
    name: 'Claude 3.5 Haiku',
    description: 'Fast and affordable Claude model',
    category: 'llm-chat',
    supportedProviders: ['anthropic'],
    provider: 'anthropic',
    capabilities: ['chat', 'vision', 'function-calling', 'json-mode', 'streaming'],
    contextWindow: 200000,
    maxOutputTokens: 8192,
    defaultTemperature: 0.7,
    execute: (input) => executeAnthropic(input, 'claude-3-5-haiku-latest'),
};
