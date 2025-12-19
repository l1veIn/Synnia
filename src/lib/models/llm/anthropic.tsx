// Anthropic Claude LLM Plugins
// Unified with ModelPlugin interface

import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { ModelPlugin, LLMExecutionInput, LLMExecutionResult, HandleSpec } from '../types';
import { extractJson } from './utils';
import { DefaultLLMSettings } from './DefaultLLMSettings';

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
// Factory Function for Claude Models
// ============================================================================

interface ClaudeModelConfig {
    id: string;
    name: string;
    description: string;
    hasVision: boolean;
    contextWindow: number;
    maxOutputTokens: number;
}

const createClaudeModel = (config: ClaudeModelConfig): ModelPlugin => ({
    id: config.id,
    name: config.name,
    description: config.description,
    category: config.hasVision ? 'llm-vision' : 'llm-chat',
    supportedProviders: ['anthropic'],
    provider: 'anthropic',
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

    execute: (input) => executeAnthropic(input as LLMExecutionInput, config.id),
});

// ============================================================================
// Claude Model Exports
// ============================================================================

export const claude35Sonnet = createClaudeModel({
    id: 'claude-3-5-sonnet-latest',
    name: 'Claude 3.5 Sonnet',
    description: 'Most intelligent Claude model',
    hasVision: true,
    contextWindow: 200000,
    maxOutputTokens: 8192,
});

export const claude35Haiku = createClaudeModel({
    id: 'claude-3-5-haiku-latest',
    name: 'Claude 3.5 Haiku',
    description: 'Fast and affordable Claude model',
    hasVision: true,  // Haiku also supports vision
    contextWindow: 200000,
    maxOutputTokens: 8192,
});
