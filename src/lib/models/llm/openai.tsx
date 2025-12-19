// OpenAI LLM Plugins
// Unified with ModelPlugin interface

import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { ModelPlugin, LLMExecutionInput, LLMExecutionResult, HandleSpec } from '../types';
import { extractJson } from './utils';
import { DefaultLLMSettings } from './DefaultLLMSettings';

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
        console.error('[OpenAI] Call failed:', error);
        return { success: false, error: error.message || 'OpenAI call failed' };
    }
}

// ============================================================================
// Factory Function for OpenAI Models
// ============================================================================

interface OpenAIModelConfig {
    id: string;
    name: string;
    description: string;
    hasVision: boolean;
    contextWindow: number;
    maxOutputTokens: number;
}

const createOpenAIModel = (config: OpenAIModelConfig): ModelPlugin => ({
    id: config.id,
    name: config.name,
    description: config.description,
    category: config.hasVision ? 'llm-vision' : 'llm-chat',
    supportedProviders: ['openai'],
    provider: 'openai',
    capabilities: config.hasVision
        ? ['chat', 'vision', 'function-calling', 'json-mode', 'streaming']
        : ['chat', 'function-calling', 'json-mode', 'streaming'],
    contextWindow: config.contextWindow,
    maxOutputTokens: config.maxOutputTokens,
    defaultTemperature: 0.7,

    renderConfig: (props) => (
        <DefaultLLMSettings
            {...props}
            defaultTemperature={0.7}
            maxOutputTokens={config.maxOutputTokens}
        />
    ),

    getInputHandles: config.hasVision
        ? (cfg) => {
            if (!cfg?.visionImage) {
                return [{ id: 'visionImage', dataType: 'image', label: 'Vision Image' } as HandleSpec];
            }
            return [];
        }
        : undefined,

    execute: (input) => executeOpenAI(input as LLMExecutionInput, config.id),
});

// ============================================================================
// OpenAI Model Exports
// ============================================================================

export const gpt4o = createOpenAIModel({
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'Most capable GPT-4 model with vision support',
    hasVision: true,
    contextWindow: 128000,
    maxOutputTokens: 16384,
});

export const gpt4oMini = createOpenAIModel({
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Fast and affordable GPT-4o variant',
    hasVision: true,  // GPT-4o-mini also supports vision
    contextWindow: 128000,
    maxOutputTokens: 16384,
});
