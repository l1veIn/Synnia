// OpenAI LLM Plugins
// Simplified for backend-only execution

import { ModelPlugin, ModelExecutionInput, ModelExecutionResult, HandleSpec } from '../types';
import { extractJson } from '../utils';
import { DefaultLLMSettings } from '../shared/DefaultLLMSettings';

// ============================================================================
// Shared OpenAI Execution Logic (Backend)
// ============================================================================

async function executeOpenAI(
    input: ModelExecutionInput,
    modelId: string
): Promise<ModelExecutionResult> {
    const { systemPrompt, jsonMode } = input;
    const userPrompt = input.userPrompt || input.prompt || '';

    try {
        console.log('[OpenAI]: Calling backend execute_model_command');
        const { invoke } = await import('@tauri-apps/api/core');

        const result = await invoke<{
            success: boolean;
            error?: string;
            text?: string;
        }>('execute_model_command', {
            request: {
                provider: 'openai',
                modelId: modelId,
                prompt: userPrompt,
                systemPrompt: systemPrompt,
            }
        });

        if (!result.success) {
            return { success: false, error: result.error || 'Backend execution failed' };
        }

        const responseText = result.text || '';

        if (jsonMode) {
            const { data, success } = extractJson(responseText);
            if (success) {
                return { success: true, text: responseText, data };
            } else {
                return { success: false, text: responseText, error: 'Failed to parse JSON' };
            }
        }

        return { success: true, text: responseText };
    } catch (error: any) {
        console.error('[OpenAI] Backend call failed:', error);
        return { success: false, error: error.message || 'OpenAI backend call failed' };
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
    category: 'llm',  // Unified LLM category
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

    execute: (input) => executeOpenAI(input as ModelExecutionInput, config.id),
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
