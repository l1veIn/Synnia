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

export interface AppSettings {
    // Provider configurations
    providers: Partial<Record<ProviderKey, ProviderConfig>>;

    // Default models per category (e.g., 'llm-chat': 'gpt-4o')
    defaultModels: Partial<Record<string, string>>;

    // Settings version for future migrations
    _version: number;
}



// Default settings
export function createDefaultSettings(): AppSettings {
    return {
        providers: {},
        defaultModels: {
            'llm-chat': 'gpt-4o-mini',
            'llm-vision': 'gpt-4o',
        },
        _version: 3,
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
