// Unified Settings Types
// Support both cloud providers (API key) and local providers (base URL)

import { ProviderKey } from '@features/models/types';
import { PROVIDER_INFO } from '@features/models/providers';

export type { ProviderKey, ProviderInfo } from '@features/models/types';
export { PROVIDER_INFO } from '@features/models/providers';

// Provider configuration
export interface ProviderConfig {
    apiKey?: string;     // Required for cloud providers
    baseUrl?: string;    // Required for local providers, optional for cloud
    enabled?: boolean;   // Explicit enable flag
}

// Default LLM parameters
export interface DefaultLLMParams {
    temperature?: number;
    maxTokens?: number;
}

export interface AppSettings {
    // Provider configurations
    providers: Partial<Record<ProviderKey, ProviderConfig>>;

    // Default models per category (e.g., 'llm': 'gpt-4o')
    defaultModels: Partial<Record<string, string>>;

    // Default LLM generation parameters
    defaultLLMParams?: DefaultLLMParams;

    // Settings version for future migrations
    _version: number;
}



// Default settings
export function createDefaultSettings(): AppSettings {
    return {
        providers: {},
        defaultModels: {},
        defaultLLMParams: {},
        _version: 4,
    };
}

// Helper: Get default model for a category
export function getDefaultModel(
    settings: AppSettings | null,
    category: string
): string | undefined {
    return settings?.defaultModels?.[category];
}

// Helper: Check if a provider is configured
// Cloud providers: require API key
// Local providers: always considered configured if they have a default endpoint
export function isProviderConfigured(
    settings: AppSettings | null,
    provider: ProviderKey
): boolean {
    const config = settings?.providers?.[provider];
    const info = PROVIDER_INFO.find(p => p.key === provider);

    // Local providers with default endpoint are always "configured"
    if (info?.type === 'local') {
        return !!config?.baseUrl || !!config?.apiKey || !!info.defaultBaseUrl;
    }

    // Cloud providers require API key
    return !!config?.apiKey;
}

// Helper: Get API key or base URL for a provider
// Returns user-configured values, falling back to defaultBaseUrl if not set
export function getProviderCredentials(
    settings: AppSettings | null,
    provider: ProviderKey
): { apiKey?: string; baseUrl?: string } | null {
    const config = settings?.providers?.[provider];
    const info = PROVIDER_INFO.find(p => p.key === provider);

    // Build credentials with fallback to default base URL
    return {
        apiKey: config?.apiKey,
        baseUrl: config?.baseUrl || info?.defaultBaseUrl,
    };
}
