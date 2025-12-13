import { defineRecipe } from '@/types/recipe';
import { invoke } from '@tauri-apps/api/core';
import { Sparkles } from 'lucide-react';

/**
 * LLM Call Recipe
 * Calls the configured LLM (Gemini) with a prompt
 */
export const definition = defineRecipe({
    id: 'llm.call',
    name: 'LLM Call',
    description: 'Call the configured LLM with a prompt',
    icon: Sparkles,
    category: 'AI',

    inputSchema: [
        {
            id: 'prompt',
            key: 'prompt',
            label: 'Prompt',
            type: 'string',
            widget: 'textarea',
            rules: { required: true, placeholder: 'Enter your prompt...' },
            connection: { input: true, output: true }  // Both input and output for chain reuse
        },
        {
            id: 'systemPrompt',
            key: 'systemPrompt',
            label: 'System Prompt',
            type: 'string',
            widget: 'textarea',
            rules: { placeholder: 'Optional system instructions...' },
            connection: { input: true, output: true }  // Both input and output for chain reuse
        },
        {
            id: 'temperature',
            key: 'temperature',
            label: 'Temperature',
            type: 'number',
            widget: 'slider',
            defaultValue: 0.7,
            rules: { min: 0, max: 2, step: 0.1 }
        },
        {
            id: 'maxTokens',
            key: 'maxTokens',
            label: 'Max Tokens',
            type: 'number',
            widget: 'number',
            defaultValue: 2048,
            rules: { min: 1, max: 8192 }
        },
        {
            id: 'response',
            key: 'response',
            label: 'Response',
            type: 'string',
            widget: 'none',
            disabled: true,
            connection: { output: true }  // Output handle for response
        }
    ],

    outputSchema: {
        type: 'text',
        description: 'LLM response text'
    },

    execute: async (ctx) => {
        const { inputs } = ctx;

        // Extract text values from potentially connected inputs
        const extractText = (v: any): string => {
            if (typeof v === 'object' && v !== null) {
                if (v.content !== undefined) return String(v.content);
                if (v.value !== undefined) return String(v.value);
            }
            return String(v || '');
        };

        const prompt = extractText(inputs.prompt);
        const systemPrompt = extractText(inputs.systemPrompt);
        const temperature = Number(inputs.temperature ?? 0.7);
        const maxTokens = Number(inputs.maxTokens ?? 2048);

        if (!prompt.trim()) {
            return {
                success: false,
                error: 'Prompt is required'
            };
        }

        try {
            // Get settings from Tauri backend
            const apiKey = await invoke<string>('get_api_key');
            const baseUrl = await invoke<string>('get_base_url').catch(() => 'https://generativelanguage.googleapis.com');
            const modelName = await invoke<string>('get_model_name').catch(() => 'gemini-1.5-flash');

            if (!apiKey) {
                return {
                    success: false,
                    error: 'API key not configured. Please set it in Settings.'
                };
            }

            // Build request to Gemini API
            const url = `${baseUrl}/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

            const contents: any[] = [];

            // Add system instruction if provided
            if (systemPrompt.trim()) {
                contents.push({
                    role: 'user',
                    parts: [{ text: `System: ${systemPrompt}` }]
                });
                contents.push({
                    role: 'model',
                    parts: [{ text: 'Understood. I will follow these instructions.' }]
                });
            }

            // Add user prompt
            contents.push({
                role: 'user',
                parts: [{ text: prompt }]
            });

            const requestBody = {
                contents,
                generationConfig: {
                    temperature,
                    maxOutputTokens: maxTokens
                }
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData?.error?.message || `API error: ${response.status}`;
                return {
                    success: false,
                    error: errorMessage
                };
            }

            const data = await response.json();
            const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

            return {
                success: true,
                data: {
                    response: responseText,
                    model: modelName,
                    promptTokens: prompt.length,
                    responseTokens: responseText.length
                }
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message || 'Failed to call LLM'
            };
        }
    }
});
