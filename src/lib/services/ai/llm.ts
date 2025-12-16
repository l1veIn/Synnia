// LLM Service
// Core service for making LLM calls using Vercel AI SDK

import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { invoke } from '@tauri-apps/api/core';
import { LLMRequest, LLMResponse, AIProvider } from './types';
import { getProvider, getDefaultLLMProvider } from './config';

/**
 * Create a model instance for the given provider
 */
function createModel(provider: AIProvider, modelName?: string) {
    const model = modelName || provider.defaultModel;

    switch (provider.kind) {
        case 'gemini': {
            const google = createGoogleGenerativeAI({
                apiKey: provider.apiKey || '',
                baseURL: provider.baseUrl.includes('generativelanguage.googleapis.com')
                    ? undefined
                    : provider.baseUrl,
            });
            return google(model);
        }

        case 'openai': {
            const openai = createOpenAI({
                apiKey: provider.apiKey || '',
                baseURL: provider.baseUrl,
            });
            return openai(model);
        }

        case 'ollama': {
            // Ollama uses OpenAI-compatible API
            const ollama = createOpenAI({
                apiKey: 'ollama', // Ollama doesn't need real API key
                baseURL: `${provider.baseUrl}/v1`,
            });
            return ollama(model);
        }

        default:
            throw new Error(`Unsupported provider kind: ${provider.kind}`);
    }
}

/**
 * Attempt to repair a truncated JSON array
 */
function repairTruncatedJsonArray(jsonText: string): string | null {
    let text = jsonText.trim();
    if (!text.startsWith('[')) return null;

    try {
        JSON.parse(text);
        return text;
    } catch { }

    const lastCompleteObject = text.lastIndexOf('}');
    if (lastCompleteObject === -1) return null;

    text = text.substring(0, lastCompleteObject + 1);
    text = text.replace(/,\s*$/, '');
    text = text + ']';

    try {
        JSON.parse(text);
        return text;
    } catch {
        return null;
    }
}

/**
 * Extract JSON from LLM response text
 */
function extractJson(text: string): { data: any; success: boolean } {
    // Try to extract JSON from markdown code blocks
    let jsonText = text;
    const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
        jsonText = jsonBlockMatch[1];
    } else {
        // Try to find JSON array pattern
        const arrayMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (arrayMatch) jsonText = arrayMatch[0];
    }

    try {
        return { data: JSON.parse(jsonText), success: true };
    } catch {
        // Try to repair truncated JSON
        const repaired = repairTruncatedJsonArray(jsonText);
        if (repaired) {
            return { data: JSON.parse(repaired), success: true };
        }
        return { data: null, success: false };
    }
}

/**
 * Call LLM with the given request
 */
export async function callLLM(request: LLMRequest): Promise<LLMResponse> {
    try {
        // Get provider
        const provider = request.providerId
            ? await getProvider(request.providerId)
            : await getDefaultLLMProvider();

        if (!provider) {
            return { success: false, error: 'No LLM provider configured. Please configure one in Settings.' };
        }

        if (!provider.apiKey && provider.kind !== 'ollama') {
            return { success: false, error: `API key not configured for ${provider.name}. Please update in Settings.` };
        }

        // Create model
        const model = createModel(provider, request.model);

        // Build prompt
        let prompt = request.userPrompt;
        if (request.systemPrompt) {
            prompt = `System: ${request.systemPrompt}\n\nUser: ${request.userPrompt}`;
        }

        // Call LLM
        const result = await generateText({
            model,
            prompt,
            temperature: request.temperature ?? 0.7,
            maxOutputTokens: request.maxTokens ?? 2048,
        });

        const responseText = result.text;
        const wasTruncated = result.finishReason === 'length';

        if (wasTruncated) {
            console.warn('[LLM] Response was truncated due to token limit');
        }

        // Parse response if needed
        if (request.parseAs === 'json') {
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
        console.error('[LLM] Call failed:', error);
        return { success: false, error: error.message || 'LLM call failed' };
    }
}

/**
 * Convenience function for simple text generation
 */
export async function generateTextSimple(prompt: string): Promise<string> {
    const response = await callLLM({ userPrompt: prompt });
    if (response.success && response.text) {
        return response.text;
    }
    throw new Error(response.error || 'Generation failed');
}
