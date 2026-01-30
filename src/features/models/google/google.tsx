// Google Gemini LLM Plugins
// Unified with ModelPlugin interface

import { generateText, streamText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { ModelPlugin, ModelExecutionInput, ModelExecutionResult, HandleSpec } from '../types';
import { extractJson } from '../utils';
import { DefaultLLMSettings } from '../shared/DefaultLLMSettings';

// ============================================================================
// Shared Google Execution Logic
// ============================================================================

async function executeGoogle(
    input: ModelExecutionInput,
    modelId: string
): Promise<ModelExecutionResult> {
    const { credentials, systemPrompt, temperature, maxTokens, jsonMode } = input;
    const userPrompt = input.userPrompt || input.prompt || '';

    if (!credentials.apiKey) {
        return { success: false, error: 'Google API key not configured' };
    }

    try {
        const google = createGoogleGenerativeAI({
            apiKey: credentials.apiKey,
            // Only set baseURL for non-default endpoints (custom proxies)
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
// Factory Function for Gemini Models
// ============================================================================

interface GeminiModelConfig {
    id: string;
    name: string;
    description: string;
    hasVision: boolean;
    contextWindow: number;
    maxOutputTokens: number;
}

const createGeminiModel = (config: GeminiModelConfig): ModelPlugin => ({
    id: config.id,
    name: config.name,
    description: config.description,
    category: 'llm',  // Unified LLM category
    supportedProviders: ['google'],
    provider: 'google',
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

    execute: (input) => executeGoogle(input as ModelExecutionInput, config.id),

    getChatAdapter: (credentials, modelConfig) => ({
        async *run({ messages, abortSignal }) {
            const google = createGoogleGenerativeAI({
                apiKey: credentials.apiKey,
                baseURL: credentials.baseUrl?.includes('generativelanguage.googleapis.com')
                    ? undefined
                    : credentials.baseUrl,
            });

            const model = google(config.id);

            // Convert assistant-ui ThreadMessage to AI SDK message format
            // assistant-ui content is ContentPart[], we need to extract text
            const aiMessages = messages.map(msg => ({
                role: msg.role as 'user' | 'assistant' | 'system',
                content: msg.content
                    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
                    .map(part => part.text)
                    .join(''),
            }));

            const result = streamText({
                model,
                messages: aiMessages,
                temperature: modelConfig?.temperature ?? 0.7,
                maxOutputTokens: modelConfig?.maxTokens ?? config.maxOutputTokens,
                abortSignal,
            });

            // Stream text chunks - assistant-ui expects cumulative content
            let accumulatedText = '';
            for await (const chunk of result.textStream) {
                accumulatedText += chunk;
                yield { content: [{ type: 'text' as const, text: accumulatedText }] };
            }
        }
    }),
});

// ============================================================================
// Gemini Model Exports
// ============================================================================

export const gemini25Flash = createGeminiModel({
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Latest Gemini with 1M context',
    hasVision: true,
    contextWindow: 1000000,
    maxOutputTokens: 65536,
});

export const gemini2Flash = createGeminiModel({
    id: 'gemini-2.0-flash-exp',
    name: 'Gemini 2.0 Flash',
    description: 'Fast Gemini model with multimodal support',
    hasVision: true,
    contextWindow: 1000000,
    maxOutputTokens: 8192,
});
