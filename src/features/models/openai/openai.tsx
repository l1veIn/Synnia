// OpenAI LLM Plugins
// Model definitions only - execution handled by AgentExecutor

import { ModelPlugin, HandleSpec } from '../types';
import { DefaultLLMSettings } from '../shared/DefaultLLMSettings';

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
    category: 'llm',
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
    // No execute - AgentExecutor uses backend execute_model_command
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
