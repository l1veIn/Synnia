// Unified Settings Module
// Simple API Key + Base URL management with React hook

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AppSettings, ProviderKey, ProviderConfig, createDefaultSettings } from './types';

// ============================================================================
// Settings State
// ============================================================================

let cachedSettings: AppSettings | null = null;

/**
 * Load settings from backend
 */
export async function loadSettings(): Promise<AppSettings> {
    if (cachedSettings) return cachedSettings;

    try {
        const jsonStr = await invoke<string | null>('get_app_settings');
        if (jsonStr) {
            cachedSettings = JSON.parse(jsonStr);
            return cachedSettings!;
        }
    } catch (e) {
        console.warn('[Settings] Failed to load, using default:', e);
    }

    cachedSettings = createDefaultSettings();
    return cachedSettings;
}

/**
 * Save settings to backend
 */
export async function saveSettings(settings: AppSettings): Promise<void> {
    cachedSettings = settings;
    try {
        await invoke('save_app_settings', { settings: JSON.stringify(settings) });
    } catch (e) {
        console.error('[Settings] Failed to save:', e);
        throw e;
    }
}

/**
 * Get cached settings synchronously (null if not loaded)
 */
export function getSettings(): AppSettings | null {
    return cachedSettings;
}

/**
 * Get API key for a provider
 */
export function getApiKey(provider: ProviderKey): string | undefined {
    return cachedSettings?.providers?.[provider]?.apiKey;
}

/**
 * Get base URL for a provider
 */
export function getBaseUrl(provider: ProviderKey): string | undefined {
    return cachedSettings?.providers?.[provider]?.baseUrl;
}

/**
 * Clear settings cache
 */
export function invalidateSettingsCache(): void {
    cachedSettings = null;
}

// ============================================================================
// React Hook
// ============================================================================

export interface UseSettingsReturn {
    settings: AppSettings | null;
    loading: boolean;
    error: Error | null;
    updateProvider: (provider: ProviderKey, config: Partial<ProviderConfig>) => Promise<void>;
    setDefaultLLM: (model: string) => Promise<void>;
    refresh: () => Promise<void>;
}

export function useSettings(): UseSettingsReturn {
    const [settings, setSettings] = useState<AppSettings | null>(cachedSettings);
    const [loading, setLoading] = useState(!cachedSettings);
    const [error, setError] = useState<Error | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            invalidateSettingsCache();
            const newSettings = await loadSettings();
            setSettings(newSettings);
        } catch (e) {
            setError(e as Error);
        } finally {
            setLoading(false);
        }
    }, []);

    const updateProvider = useCallback(async (provider: ProviderKey, config: Partial<ProviderConfig>) => {
        if (!settings) return;

        const currentConfig = settings.providers?.[provider] || {};
        const newConfig = { ...currentConfig, ...config };

        // Remove empty values
        if (!newConfig.apiKey) delete newConfig.apiKey;
        if (!newConfig.baseUrl) delete newConfig.baseUrl;

        const newSettings: AppSettings = {
            ...settings,
            providers: {
                ...settings.providers,
                [provider]: Object.keys(newConfig).length > 0 ? newConfig : undefined,
            },
        };

        await saveSettings(newSettings);
        setSettings(newSettings);
    }, [settings]);

    const setDefaultLLM = useCallback(async (model: string) => {
        if (!settings) return;
        const newSettings: AppSettings = {
            ...settings,
            defaultLLM: model,
        };
        await saveSettings(newSettings);
        setSettings(newSettings);
    }, [settings]);

    useEffect(() => {
        if (!cachedSettings) {
            loadSettings()
                .then(setSettings)
                .catch(setError)
                .finally(() => setLoading(false));
        }
    }, []);

    return { settings, loading, error, updateProvider, setDefaultLLM, refresh };
}

// Re-export types
export * from './types';
