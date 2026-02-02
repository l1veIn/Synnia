import { ProviderInfo, ProviderKey } from './types';

// Static provider info - synced with backend ProviderType
// Used as fallback when backend is not available
export const PROVIDER_INFO: ProviderInfo[] = [
    // Cloud providers
    {
        key: 'openai',
        name: 'OpenAI',
        description: 'GPT-4o, DALL-E 3',
        type: 'cloud',
        placeholder: 'sk-...',
        defaultBaseUrl: 'https://api.openai.com/v1',
        requiresApiKey: true,
    },
    {
        key: 'anthropic',
        name: 'Anthropic',
        description: 'Claude 3.5 Sonnet',
        type: 'cloud',
        placeholder: 'sk-ant-...',
        defaultBaseUrl: 'https://api.anthropic.com/v1',
        requiresApiKey: true,
    },
    {
        key: 'google',
        name: 'Google AI',
        description: 'Gemini 2.0, Imagen',
        type: 'cloud',
        placeholder: 'AIza...',
        defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        requiresApiKey: true,
    },
    {
        key: 'fal',
        name: 'FAL.ai',
        description: 'Flux, Nano Banana, Kling',
        type: 'cloud',
        placeholder: 'fal_...',
        defaultBaseUrl: 'https://fal.run',
        requiresApiKey: true,
    },
    {
        key: 'deepseek',
        name: 'DeepSeek',
        description: 'DeepSeek V3',
        type: 'cloud',
        placeholder: 'sk-...',
        defaultBaseUrl: 'https://api.deepseek.com/v1',
        requiresApiKey: true,
    },
    {
        key: 'zhipu',
        name: 'Zhipu AI',
        description: 'GLM-4.7, GLM-4.6v',
        type: 'cloud',
        placeholder: 'your-zhipu-api-key',
        defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        requiresApiKey: true,
    },
    // Local providers
    {
        key: 'ollama',
        name: 'Ollama',
        description: 'Local LLM server',
        type: 'local',
        placeholder: 'Optional API key',
        defaultBaseUrl: 'http://localhost:11434',
        requiresApiKey: false,
    },
    {
        key: 'lmstudio',
        name: 'LM Studio',
        description: 'Local LLM server',
        type: 'local',
        placeholder: 'Optional API key',
        defaultBaseUrl: 'http://localhost:1234',
        requiresApiKey: false,
    },
    {
        key: 'g4f',
        name: 'GPT4Free',
        description: 'Local proxy (Gemini Imagen, etc.)',
        type: 'local',
        placeholder: 'Optional API key',
        defaultBaseUrl: 'http://localhost:8080',
        requiresApiKey: false,
    },
];

// ============================================================================
// Backend API Functions
// ============================================================================

interface BackendProviderInfo {
    key: string;
    name: string;
    description: string;
    providerType: string;  // camelCase from backend
    placeholder: string;
    defaultBaseUrl?: string;
    requiresApiKey: boolean;
}

/**
 * Fetch all providers from backend.
 * Falls back to static PROVIDER_INFO if backend is unavailable.
 */
export async function fetchAllProviders(): Promise<ProviderInfo[]> {
    try {
        const { invoke } = await import('@tauri-apps/api/core');
        const backendProviders = await invoke<BackendProviderInfo[]>('get_all_providers_command');

        // Map backend format to frontend format
        return backendProviders.map(p => ({
            key: p.key as ProviderKey,
            name: p.name,
            description: p.description,
            type: p.providerType as 'cloud' | 'local',
            placeholder: p.placeholder,
            defaultBaseUrl: p.defaultBaseUrl,
            requiresApiKey: p.requiresApiKey,
        }));
    } catch (error) {
        console.warn('[providers] Backend unavailable, using static fallback:', error);
        return PROVIDER_INFO;
    }
}

/**
 * Get all provider keys.
 */
export function getAllProviderKeys(): ProviderKey[] {
    return PROVIDER_INFO.map(p => p.key);
}

/**
 * Find provider info by key.
 */
export function getProviderByKey(key: ProviderKey): ProviderInfo | undefined {
    return PROVIDER_INFO.find(p => p.key === key);
}

