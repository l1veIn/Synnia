// Anthropic Claude LLM Plugins
// Model definitions only - execution handled by AgentExecutor

import { ModelPlugin, HandleSpec } from '../types';
import { DefaultLLMSettings } from '../shared/DefaultLLMSettings';

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
    category: 'llm',
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
    // No execute - AgentExecutor uses backend execute_model_command
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
