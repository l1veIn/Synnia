// DeepSeek LLM Plugins
// Simplified for backend-only execution

import { ModelPlugin, ModelExecutionInput, ModelExecutionResult } from '../types';
import { extractJson } from '../utils';
import { DefaultLLMSettings } from '../shared/DefaultLLMSettings';

// ============================================================================
// Shared DeepSeek Execution Logic (Backend)
// ============================================================================

async function executeDeepSeek(
    input: ModelExecutionInput,
    modelId: string
): Promise<ModelExecutionResult> {
    const { systemPrompt, jsonMode } = input;
    const userPrompt = input.userPrompt || input.prompt || '';

    try {
        console.log('[DeepSeek]: Calling backend execute_model_command');
        const { invoke } = await import('@tauri-apps/api/core');

        const result = await invoke<{
            success: boolean;
            error?: string;
            text?: string;
        }>('execute_model_command', {
            request: {
                provider: 'deepseek',
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
        console.error('[DeepSeek] Backend call failed:', error);
        return { success: false, error: error.message || 'DeepSeek backend call failed' };
    }
}


// ============================================================================
// DeepSeek Model Exports
// ============================================================================

export const deepseekChat: ModelPlugin = {
    id: 'deepseek-chat',
    name: 'DeepSeek V3',
    description: 'DeepSeek V3 MoE model',
    category: 'llm',  // Unified LLM category
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

    execute: (input) => executeDeepSeek(input as ModelExecutionInput, 'deepseek-chat'),
};
