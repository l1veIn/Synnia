// LLM Model Types and Registry

import { ProviderKey } from '@/lib/settings';

// LLM capabilities
export type LLMCapability =
    | 'chat'
    | 'vision'
    | 'function-calling'
    | 'json-mode'
    | 'streaming';

// LLM model definition
export interface LLMModelDefinition {
    id: string;
    name: string;
    provider: ProviderKey;
    capabilities: LLMCapability[];
    contextWindow: number;         // Max context length
    maxOutputTokens: number;       // Max output tokens
    defaultTemperature?: number;
    isLocal?: boolean;             // True for Ollama/LM Studio models
}

// LLM configuration value (returned by LLMConfigurator)
export interface LLMConfigValue {
    modelId: string;
    provider: ProviderKey;
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
}

// ============================================================================
// Model Registry
// ============================================================================

export const LLM_MODELS: LLMModelDefinition[] = [
    // OpenAI
    {
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'openai',
        capabilities: ['chat', 'vision', 'function-calling', 'json-mode', 'streaming'],
        contextWindow: 128000,
        maxOutputTokens: 16384,
        defaultTemperature: 0.7,
    },
    {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'openai',
        capabilities: ['chat', 'vision', 'function-calling', 'json-mode', 'streaming'],
        contextWindow: 128000,
        maxOutputTokens: 16384,
        defaultTemperature: 0.7,
    },
    {
        id: 'o1-preview',
        name: 'o1 Preview',
        provider: 'openai',
        capabilities: ['chat', 'json-mode'],
        contextWindow: 128000,
        maxOutputTokens: 32768,
    },

    // Anthropic
    {
        id: 'claude-3-5-sonnet-latest',
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        capabilities: ['chat', 'vision', 'function-calling', 'json-mode', 'streaming'],
        contextWindow: 200000,
        maxOutputTokens: 8192,
        defaultTemperature: 0.7,
    },
    {
        id: 'claude-3-5-haiku-latest',
        name: 'Claude 3.5 Haiku',
        provider: 'anthropic',
        capabilities: ['chat', 'vision', 'function-calling', 'json-mode', 'streaming'],
        contextWindow: 200000,
        maxOutputTokens: 8192,
        defaultTemperature: 0.7,
    },

    // Google
    {
        id: 'gemini-2.0-flash-exp',
        name: 'Gemini 2.0 Flash',
        provider: 'google',
        capabilities: ['chat', 'vision', 'function-calling', 'json-mode', 'streaming'],
        contextWindow: 1000000,
        maxOutputTokens: 8192,
        defaultTemperature: 0.7,
    },
    {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        provider: 'google',
        capabilities: ['chat', 'vision', 'function-calling', 'json-mode', 'streaming'],
        contextWindow: 1000000,
        maxOutputTokens: 65536,
        defaultTemperature: 0.7,
    },

    // DeepSeek
    {
        id: 'deepseek-chat',
        name: 'DeepSeek V3',
        provider: 'deepseek',
        capabilities: ['chat', 'function-calling', 'json-mode', 'streaming'],
        contextWindow: 64000,
        maxOutputTokens: 8192,
        defaultTemperature: 0.7,
    },

    // Ollama (local)
    {
        id: 'llama3.2',
        name: 'Llama 3.2',
        provider: 'ollama',
        capabilities: ['chat', 'streaming'],
        contextWindow: 128000,
        maxOutputTokens: 4096,
        defaultTemperature: 0.7,
        isLocal: true,
    },
    {
        id: 'llama3.2-vision',
        name: 'Llama 3.2 Vision',
        provider: 'ollama',
        capabilities: ['chat', 'vision', 'streaming'],
        contextWindow: 128000,
        maxOutputTokens: 4096,
        defaultTemperature: 0.7,
        isLocal: true,
    },
    {
        id: 'qwen2.5',
        name: 'Qwen 2.5',
        provider: 'ollama',
        capabilities: ['chat', 'function-calling', 'streaming'],
        contextWindow: 32000,
        maxOutputTokens: 4096,
        defaultTemperature: 0.7,
        isLocal: true,
    },
    {
        id: 'deepseek-r1',
        name: 'DeepSeek R1',
        provider: 'ollama',
        capabilities: ['chat', 'streaming'],
        contextWindow: 64000,
        maxOutputTokens: 8192,
        defaultTemperature: 0.7,
        isLocal: true,
    },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all LLM models
 */
export function getAllLLMModels(): LLMModelDefinition[] {
    return LLM_MODELS;
}

/**
 * Get LLM model by ID
 */
export function getLLMModel(id: string): LLMModelDefinition | undefined {
    return LLM_MODELS.find(m => m.id === id);
}

/**
 * Get LLM models for a specific provider
 */
export function getLLMModelsForProvider(provider: ProviderKey): LLMModelDefinition[] {
    return LLM_MODELS.filter(m => m.provider === provider);
}

/**
 * Get LLM models with a specific capability
 */
export function getLLMModelsForCapability(capability: LLMCapability): LLMModelDefinition[] {
    return LLM_MODELS.filter(m => m.capabilities.includes(capability));
}

/**
 * Get models that support vision (for image analysis)
 */
export function getVisionModels(): LLMModelDefinition[] {
    return getLLMModelsForCapability('vision');
}
