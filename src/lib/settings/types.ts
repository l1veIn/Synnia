// Unified Settings Types
// Support both cloud providers (API key) and local providers (base URL)

export type ProviderKey =
    // Cloud providers (need API key)
    | 'openai'
    | 'anthropic'
    | 'google'
    | 'fal'
    | 'replicate'
    | 'deepseek'
    | 'ppio'
    // Local/self-hosted providers (need base URL)
    | 'ollama'
    | 'lmstudio'
    | 'comfyui';

// Provider configuration
export interface ProviderConfig {
    apiKey?: string;     // Required for cloud providers
    baseUrl?: string;    // Required for local providers, optional for cloud
    enabled?: boolean;   // Explicit enable flag
}

export interface AppSettings {
    // Provider configurations
    providers: Partial<Record<ProviderKey, ProviderConfig>>;

    // Default LLM for utility functions (PromptEnhancer, AutoGenerate)
    defaultLLM: string;

    // Settings version for future migrations
    _version: number;
}

// Provider metadata for UI display
export interface ProviderInfo {
    key: ProviderKey;
    name: string;
    description: string;
    type: 'cloud' | 'local';
    placeholder: string;           // For API key or base URL
    defaultBaseUrl?: string;       // Default base URL for local providers
    requiresApiKey: boolean;
}

export const PROVIDER_INFO: ProviderInfo[] = [
    // Cloud providers
    {
        key: 'openai',
        name: 'OpenAI',
        description: 'GPT-4o, DALL-E 3',
        type: 'cloud',
        placeholder: 'sk-...',
        requiresApiKey: true,
    },
    {
        key: 'anthropic',
        name: 'Anthropic',
        description: 'Claude 3.5 Sonnet',
        type: 'cloud',
        placeholder: 'sk-ant-...',
        requiresApiKey: true,
    },
    {
        key: 'google',
        name: 'Google AI',
        description: 'Gemini 2.0, Imagen',
        type: 'cloud',
        placeholder: 'AIza...',
        requiresApiKey: true,
    },
    {
        key: 'fal',
        name: 'FAL.ai',
        description: 'Flux, Nano Banana, Kling',
        type: 'cloud',
        placeholder: 'fal_...',
        requiresApiKey: true,
    },
    {
        key: 'replicate',
        name: 'Replicate',
        description: 'Various open models',
        type: 'cloud',
        placeholder: 'r8_...',
        requiresApiKey: true,
    },
    {
        key: 'deepseek',
        name: 'DeepSeek',
        description: 'DeepSeek V3',
        type: 'cloud',
        placeholder: 'sk-...',
        requiresApiKey: true,
    },
    {
        key: 'ppio',
        name: 'PPIO',
        description: 'PPIO Cloud GPU',
        type: 'cloud',
        placeholder: 'pp_...',
        requiresApiKey: true,
    },
    // Local providers
    {
        key: 'ollama',
        name: 'Ollama',
        description: 'Local LLM server',
        type: 'local',
        placeholder: 'http://localhost:11434',
        defaultBaseUrl: 'http://localhost:11434',
        requiresApiKey: false,
    },
    {
        key: 'lmstudio',
        name: 'LM Studio',
        description: 'Local LLM server',
        type: 'local',
        placeholder: 'http://localhost:1234',
        defaultBaseUrl: 'http://localhost:1234',
        requiresApiKey: false,
    },
    {
        key: 'comfyui',
        name: 'ComfyUI',
        description: 'Local image generation',
        type: 'local',
        placeholder: 'http://localhost:8188',
        defaultBaseUrl: 'http://localhost:8188',
        requiresApiKey: false,
    },
];



// Default settings
export function createDefaultSettings(): AppSettings {
    return {
        providers: {},
        defaultLLM: 'gpt-4o-mini',
        _version: 2,
    };
}

// Helper: Check if a provider is configured
export function isProviderConfigured(
    settings: AppSettings | null,
    provider: ProviderKey
): boolean {
    if (!settings?.providers) return false;
    const config = settings.providers[provider];
    if (!config) return false;

    const info = PROVIDER_INFO.find(p => p.key === provider);
    if (info?.type === 'local') {
        return !!config.baseUrl || !!config.enabled;
    }
    return !!config.apiKey;
}

// Helper: Get API key or base URL for a provider
export function getProviderCredentials(
    settings: AppSettings | null,
    provider: ProviderKey
): { apiKey?: string; baseUrl?: string } | null {
    if (!settings?.providers) return null;
    const config = settings.providers[provider];
    if (!config) return null;

    return {
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
    };
}
