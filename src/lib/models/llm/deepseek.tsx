// DeepSeek LLM Plugins
// Unified with ModelPlugin interface

import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { ModelPlugin, LLMExecutionInput, LLMExecutionResult } from '../types';
import { extractJson } from './utils';
import { DefaultLLMSettings } from './DefaultLLMSettings';

// ============================================================================
// Shared DeepSeek Execution Logic
// ============================================================================

async function executeDeepSeek(
    input: LLMExecutionInput,
    modelId: string
): Promise<LLMExecutionResult> {
    const { credentials, systemPrompt, userPrompt, temperature, maxTokens, jsonMode } = input;

    if (!credentials.apiKey) {
        return { success: false, error: 'DeepSeek API key not configured' };
    }

    try {
        const deepseek = createOpenAI({
            apiKey: credentials.apiKey,
            baseURL: credentials.baseUrl || 'https://api.deepseek.com',
        });

        const model = deepseek(modelId);

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
        console.error('[DeepSeek] Call failed:', error);
        return { success: false, error: error.message || 'DeepSeek call failed' };
    }
}

// ============================================================================
// DeepSeek Model Exports
// ============================================================================

export const deepseekChat: ModelPlugin = {
    id: 'deepseek-chat',
    name: 'DeepSeek V3',
    description: 'DeepSeek V3 MoE model',
    category: 'llm-chat',
    supportedProviders: ['deepseek'],
    provider: 'deepseek',
    capabilities: ['chat', 'function-calling', 'json-mode', 'streaming'],
    contextWindow: 64000,
    maxOutputTokens: 8192,
    defaultTemperature: 0.7,

    renderConfig: (props) => (
        <DefaultLLMSettings
            {...props}
            defaultTemperature={0.7}
            maxOutputTokens={8192}
        />
    ),

    execute: (input) => executeDeepSeek(input as LLMExecutionInput, 'deepseek-chat'),
};
