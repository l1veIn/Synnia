// DeepSeek LLM Plugins
// Model definitions only - execution handled by AgentExecutor

import { ModelPlugin } from '../types';
import { DefaultLLMSettings } from '../shared/DefaultLLMSettings';

// ============================================================================
// DeepSeek Model Exports
// ============================================================================

export const deepseekChat: ModelPlugin = {
    id: 'deepseek-chat',
    name: 'DeepSeek V3',
    description: 'DeepSeek V3 MoE model',
    category: 'llm',
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
    // No execute - AgentExecutor uses backend execute_model_command
};
