// Zhipu AI (智谱 AI) LLM Plugins
// GLM models via native fetch (avoiding SDK compatibility issues)

import { ModelPlugin, LLMExecutionInput, LLMExecutionResult, HandleSpec } from '../types';
import { extractJson } from '../utils';
import { DefaultLLMSettings } from '../shared/DefaultLLMSettings';

// ============================================================================
// Shared Zhipu Execution Logic
// ============================================================================

// Zhipu's OpenAI-compatible chat completions endpoint
const ZHIPU_CHAT_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

interface ZhipuMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface ZhipuResponse {
    choices: Array<{
        message: {
            content: string;
        };
        finish_reason: string;
    }>;
    error?: {
        message: string;
    };
}

async function executeZhipu(
    input: LLMExecutionInput,
    modelId: string
): Promise<LLMExecutionResult> {
    const { credentials, systemPrompt, temperature, maxTokens, jsonMode } = input;
    const userPrompt = input.userPrompt || input.prompt || '';

    if (!credentials.apiKey) {
        return { success: false, error: 'Zhipu API key not configured' };
    }

    try {
        // Build messages array
        const messages: ZhipuMessage[] = [];
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: userPrompt });

        // Direct fetch to Zhipu's chat/completions endpoint
        const response = await fetch(credentials.baseUrl || ZHIPU_CHAT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${credentials.apiKey}`,
            },
            body: JSON.stringify({
                model: modelId,
                messages,
                temperature: temperature ?? 0.7,
                max_tokens: maxTokens ?? 2048,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Zhipu] HTTP Error:', response.status, errorText);
            return { success: false, error: `Zhipu API error: ${response.status} - ${errorText}` };
        }

        const data: ZhipuResponse = await response.json();

        if (data.error) {
            return { success: false, error: data.error.message };
        }

        if (!data.choices || data.choices.length === 0) {
            return { success: false, error: 'No response from Zhipu API' };
        }

        const responseText = data.choices[0].message.content;
        const wasTruncated = data.choices[0].finish_reason === 'length';

        if (jsonMode) {
            const { data: jsonData, success } = extractJson(responseText);
            if (success) {
                return { success: true, text: responseText, data: jsonData, wasTruncated };
            } else {
                return { success: false, text: responseText, error: 'Failed to parse JSON', wasTruncated };
            }
        }

        return { success: true, text: responseText, wasTruncated };
    } catch (error: any) {
        console.error('[Zhipu] Call failed:', error);
        return { success: false, error: error.message || 'Zhipu API call failed' };
    }
}

// ============================================================================
// Factory Function for Zhipu Models
// ============================================================================

interface ZhipuModelConfig {
    id: string;
    name: string;
    description: string;
    hasVision: boolean;
    contextWindow: number;
    maxOutputTokens: number;
}

const createZhipuModel = (config: ZhipuModelConfig): ModelPlugin => ({
    id: config.id,
    name: config.name,
    description: config.description,
    category: 'llm',
    supportedProviders: ['zhipu'],
    provider: 'zhipu',
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

    execute: (input) => executeZhipu(input as LLMExecutionInput, config.id),
});

// ============================================================================
// Zhipu Model Exports
// ============================================================================

// GLM-4.7: Latest flagship model (200K context, 128K output)
export const glm47 = createZhipuModel({
    id: 'glm-4.7',
    name: 'GLM-4.7',
    description: 'Zhipu flagship model with reasoning capabilities',
    hasVision: false,
    contextWindow: 200000,
    maxOutputTokens: 128000,
});

// GLM-4.6v: Vision model (based on GLM-4.6, 200K context, 128K output)
export const glm46v = createZhipuModel({
    id: 'glm-4.6v',
    name: 'GLM-4.6v',
    description: 'Zhipu multimodal model with vision support',
    hasVision: true,
    contextWindow: 200000,
    maxOutputTokens: 128000,
});

// GLM-4-Flash: Fast and affordable (128K context, 16K output)
export const glm4Flash = createZhipuModel({
    id: 'glm-4-flash',
    name: 'GLM-4-Flash',
    description: 'Fast and cost-effective GLM model',
    hasVision: false,
    contextWindow: 128000,
    maxOutputTokens: 16000,
});

// GLM-4.7-Flash: Free model (200K context, 128K output)
export const glm47Flash = createZhipuModel({
    id: 'glm-4.7-flash',
    name: 'GLM-4.7-Flash',
    description: 'Free flagship model with full capabilities',
    hasVision: false,
    contextWindow: 200000,
    maxOutputTokens: 128000,
});

