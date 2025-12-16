// AI Service Types
// Provider configuration and request/response interfaces

export type ProviderType = 'llm' | 'image';
export type LLMProviderKind = 'gemini' | 'openai' | 'anthropic' | 'ollama';
export type ImageProviderKind = 'comfyui' | 'banana' | 'dalle';
export type ProviderKind = LLMProviderKind | ImageProviderKind;

/**
 * AI Provider configuration
 */
export interface AIProvider {
    id: string;              // unique id, e.g. 'gemini-default', 'ollama-local'
    type: ProviderType;
    kind: ProviderKind;
    name: string;            // display name
    enabled: boolean;

    // Connection
    baseUrl: string;
    apiKey?: string;

    // Model config
    models: string[];        // available models
    defaultModel: string;
}

/**
 * Global AI configuration
 */
export interface AIConfig {
    providers: AIProvider[];
    defaultLLM: string;      // provider id
    defaultImage: string;    // provider id
}

/**
 * LLM request parameters
 */
export interface LLMRequest {
    systemPrompt?: string;
    userPrompt: string;
    temperature?: number;
    maxTokens?: number;
    parseAs?: 'text' | 'json';

    // Optional provider override
    providerId?: string;
    model?: string;
}

/**
 * LLM response
 */
export interface LLMResponse {
    success: boolean;
    text?: string;
    data?: any;  // Parsed JSON if parseAs='json'
    error?: string;
    wasTruncated?: boolean;
}

/**
 * Preset provider templates for easy setup
 */
export const PROVIDER_PRESETS: Record<LLMProviderKind, Partial<AIProvider>> = {
    gemini: {
        kind: 'gemini',
        type: 'llm',
        name: 'Google Gemini',
        baseUrl: 'https://generativelanguage.googleapis.com',
        models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'],
        defaultModel: 'gemini-1.5-flash',
    },
    openai: {
        kind: 'openai',
        type: 'llm',
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
        defaultModel: 'gpt-4o-mini',
    },
    anthropic: {
        kind: 'anthropic',
        type: 'llm',
        name: 'Anthropic Claude',
        baseUrl: 'https://api.anthropic.com',
        models: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
        defaultModel: 'claude-3-5-sonnet-20241022',
    },
    ollama: {
        kind: 'ollama',
        type: 'llm',
        name: 'Ollama (Local)',
        baseUrl: 'http://localhost:11434',
        models: ['llama3', 'llama3.2', 'mistral', 'codellama'],
        defaultModel: 'llama3',
    },
};
