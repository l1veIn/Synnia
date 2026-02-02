// Anthropic Claude LLM Plugins
// Simplified for backend-only execution

import { ModelPlugin, ModelExecutionInput, ModelExecutionResult, HandleSpec } from '../types';
import { extractJson } from '../utils';
import { DefaultLLMSettings } from '../shared/DefaultLLMSettings';

// ============================================================================
// Shared Anthropic Execution Logic (Backend)
// ============================================================================

async function executeAnthropic(
    input: ModelExecutionInput,
    modelId: string
): Promise<ModelExecutionResult> {
    const { systemPrompt, jsonMode } = input;
    const userPrompt = input.userPrompt || input.prompt || '';

    try {
        console.log('[Anthropic]: Calling backend execute_model_command');
        const { invoke } = await import('@tauri-apps/api/core');

        const result = await invoke<{
            success: boolean;
            error?: string;
            text?: string;
        }>('execute_model_command', {
            request: {
                provider: 'anthropic',
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
        console.error('[Anthropic] Backend call failed:', error);
        return { success: false, error: error.message || 'Anthropic backend call failed' };
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
    category: 'llm',  // Unified LLM category
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

    execute: (input) => executeAnthropic(input as ModelExecutionInput, config.id),
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
