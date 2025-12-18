// Ollama LLM Plugins (Local)
// Uses OpenAI-compatible API

import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { LLMPlugin, LLMExecutionInput, LLMExecutionResult } from '../types';
import { extractJson } from './utils';

// ============================================================================
// Shared Ollama Execution Logic
// ============================================================================

async function executeOllama(
    input: LLMExecutionInput,
    modelId: string
): Promise<LLMExecutionResult> {
    const { credentials, systemPrompt, userPrompt, temperature, maxTokens, jsonMode } = input;

    const baseUrl = credentials.baseUrl || 'http://localhost:11434';

    try {
        // Ollama uses OpenAI-compatible API
        const ollama = createOpenAI({
            apiKey: 'ollama', // Ollama doesn't need real API key
            baseURL: `${baseUrl}/v1`,
        });

        const model = ollama(modelId);

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
        console.error('[Ollama] Call failed:', error);
        return { success: false, error: error.message || 'Ollama call failed' };
    }
}

// ============================================================================
// Llama 3.2 Plugin
// ============================================================================

export const llama32: LLMPlugin = {
    id: 'llama3.2',
    name: 'Llama 3.2',
    description: 'Meta Llama 3.2 (Local)',
    category: 'llm-chat',
    supportedProviders: ['ollama'],
    provider: 'ollama',
    isLocal: true,
    capabilities: ['chat', 'streaming'],
    contextWindow: 128000,
    maxOutputTokens: 4096,
    defaultTemperature: 0.7,
    execute: (input) => executeOllama(input, 'llama3.2'),
};

// ============================================================================
// Llama 3.2 Vision Plugin
// ============================================================================

export const llama32Vision: LLMPlugin = {
    id: 'llama3.2-vision',
    name: 'Llama 3.2 Vision',
    description: 'Meta Llama 3.2 with vision (Local)',
    category: 'llm-vision',
    supportedProviders: ['ollama'],
    provider: 'ollama',
    isLocal: true,
    capabilities: ['chat', 'vision', 'streaming'],
    contextWindow: 128000,
    maxOutputTokens: 4096,
    defaultTemperature: 0.7,
    execute: (input) => executeOllama(input, 'llama3.2-vision'),
};
