// Ollama LLM Plugins (Local)
// Unified with ModelPlugin interface

import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { ModelPlugin, LLMExecutionInput, LLMExecutionResult, HandleSpec } from '../types';
import { extractJson } from './utils';
import { DefaultLLMSettings } from './DefaultLLMSettings';

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
        const ollama = createOpenAI({
            apiKey: 'ollama',
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
// Factory Function for Ollama Models  
// ============================================================================

interface OllamaModelConfig {
    id: string;
    name: string;
    description: string;
    hasVision: boolean;
    contextWindow: number;
    maxOutputTokens: number;
}

const createOllamaModel = (config: OllamaModelConfig): ModelPlugin => ({
    id: config.id,
    name: config.name,
    description: config.description,
    category: config.hasVision ? 'llm-vision' : 'llm-chat',
    supportedProviders: ['ollama'],
    provider: 'ollama',
    isLocal: true,
    capabilities: config.hasVision
        ? ['chat', 'vision', 'streaming']
        : ['chat', 'streaming'],
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

    execute: (input) => executeOllama(input as LLMExecutionInput, config.id),
});

// ============================================================================
// Ollama Model Exports
// ============================================================================

export const llama32 = createOllamaModel({
    id: 'llama3.2',
    name: 'Llama 3.2',
    description: 'Meta Llama 3.2 (Local)',
    hasVision: false,
    contextWindow: 128000,
    maxOutputTokens: 4096,
});

export const llama32Vision = createOllamaModel({
    id: 'llama3.2-vision',
    name: 'Llama 3.2 Vision',
    description: 'Meta Llama 3.2 with vision (Local)',
    hasVision: true,
    contextWindow: 128000,
    maxOutputTokens: 4096,
});
