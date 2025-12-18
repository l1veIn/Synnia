// Google Gemini LLM Plugins

import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { LLMPlugin, LLMExecutionInput, LLMExecutionResult } from '../types';
import { extractJson } from './utils';

// ============================================================================
// Shared Google Execution Logic
// ============================================================================

async function executeGoogle(
    input: LLMExecutionInput,
    modelId: string
): Promise<LLMExecutionResult> {
    const { credentials, systemPrompt, userPrompt, temperature, maxTokens, jsonMode } = input;

    if (!credentials.apiKey) {
        return { success: false, error: 'Google API key not configured' };
    }

    try {
        const google = createGoogleGenerativeAI({
            apiKey: credentials.apiKey,
            baseURL: credentials.baseUrl?.includes('generativelanguage.googleapis.com')
                ? undefined
                : credentials.baseUrl,
        });

        const model = google(modelId);

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
        console.error('[Google] Call failed:', error);
        return { success: false, error: error.message || 'Google call failed' };
    }
}

// ============================================================================
// Gemini 2.0 Flash Plugin
// ============================================================================

export const gemini2Flash: LLMPlugin = {
    id: 'gemini-2.0-flash-exp',
    name: 'Gemini 2.0 Flash',
    description: 'Fast Gemini model with multimodal support',
    category: 'llm-vision',
    supportedProviders: ['google'],
    provider: 'google',
    capabilities: ['chat', 'vision', 'function-calling', 'json-mode', 'streaming'],
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    defaultTemperature: 0.7,
    execute: (input) => executeGoogle(input, 'gemini-2.0-flash-exp'),
};

// ============================================================================
// Gemini 2.5 Flash Plugin (latest)
// ============================================================================

export const gemini25Flash: LLMPlugin = {
    id: 'gemini-2.5-flash-preview-05-20',
    name: 'Gemini 2.5 Flash',
    description: 'Latest Gemini with 1M context',
    category: 'llm-vision',
    supportedProviders: ['google'],
    provider: 'google',
    capabilities: ['chat', 'vision', 'function-calling', 'json-mode', 'streaming'],
    contextWindow: 1000000,
    maxOutputTokens: 65536,
    defaultTemperature: 0.7,
    execute: (input) => executeGoogle(input, 'gemini-2.5-flash-preview-05-20'),
};
