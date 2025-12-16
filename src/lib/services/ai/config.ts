// AI Config Service
// Load and save provider configurations from backend

import { invoke } from '@tauri-apps/api/core';
import { AIConfig, AIProvider, PROVIDER_PRESETS } from './types';

let cachedConfig: AIConfig | null = null;

/**
 * Create default config with Gemini preset
 */
export function createDefaultConfig(): AIConfig {
    const geminiProvider: AIProvider = {
        id: 'gemini-default',
        type: 'llm',
        kind: 'gemini',
        name: 'Google Gemini',
        enabled: true,
        baseUrl: 'https://generativelanguage.googleapis.com',
        apiKey: '',
        models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'],
        defaultModel: 'gemini-1.5-flash',
    };

    return {
        providers: [geminiProvider],
        defaultLLM: 'gemini-default',
        defaultImage: '',
    };
}

/**
 * Load AI config from backend
 * Falls back to default if not found
 */
export async function loadAIConfig(): Promise<AIConfig> {
    if (cachedConfig) return cachedConfig;

    try {
        // Try to load from backend
        const configJson = await invoke<string>('get_ai_config').catch(() => null);

        if (configJson) {
            cachedConfig = JSON.parse(configJson);
            return cachedConfig!;
        }
    } catch (e) {
        console.warn('[AIConfig] Failed to load config, using default:', e);
    }

    // Migrate from old Gemini-only config
    try {
        const apiKey = await invoke<string>('get_api_key').catch(() => '');
        const baseUrl = await invoke<string>('get_base_url').catch(() => 'https://generativelanguage.googleapis.com');
        const modelName = await invoke<string>('get_model_name').catch(() => 'gemini-1.5-flash');

        if (apiKey) {
            cachedConfig = createDefaultConfig();
            cachedConfig.providers[0].apiKey = apiKey;
            cachedConfig.providers[0].baseUrl = baseUrl;
            cachedConfig.providers[0].defaultModel = modelName;
            return cachedConfig;
        }
    } catch (e) {
        console.warn('[AIConfig] Failed to migrate old config:', e);
    }

    cachedConfig = createDefaultConfig();
    return cachedConfig;
}

/**
 * Save AI config to backend
 */
export async function saveAIConfig(config: AIConfig): Promise<void> {
    cachedConfig = config;
    await invoke('save_ai_config', { config: JSON.stringify(config) });
}

/**
 * Get a specific provider by ID
 */
export async function getProvider(providerId?: string): Promise<AIProvider | null> {
    const config = await loadAIConfig();

    const id = providerId || config.defaultLLM;
    return config.providers.find(p => p.id === id) || null;
}

/**
 * Get the default LLM provider
 */
export async function getDefaultLLMProvider(): Promise<AIProvider | null> {
    const config = await loadAIConfig();
    return config.providers.find(p => p.id === config.defaultLLM) || null;
}

/**
 * Get all enabled LLM providers
 */
export async function getLLMProviders(): Promise<AIProvider[]> {
    const config = await loadAIConfig();
    return config.providers.filter(p => p.type === 'llm' && p.enabled);
}

/**
 * Invalidate cached config (call after settings change)
 */
export function invalidateConfigCache(): void {
    cachedConfig = null;
}
