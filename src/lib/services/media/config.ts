// Media Provider Configuration

import { invoke } from '@tauri-apps/api/core';
import { MediaConfig, MediaProvider } from './types';

const MEDIA_CONFIG_KEY = 'media_config';

// Default config
const defaultConfig: MediaConfig = {
    providers: [],
    defaultImageProvider: undefined,
    defaultVideoProvider: undefined,
    defaultAudioProvider: undefined,
};

let cachedConfig: MediaConfig | null = null;

/**
 * Load media config from backend
 */
export async function loadMediaConfig(): Promise<MediaConfig> {
    if (cachedConfig) return cachedConfig;

    try {
        const jsonStr = await invoke<string | null>('get_media_config');
        if (jsonStr) {
            cachedConfig = JSON.parse(jsonStr);
            return cachedConfig!;
        }
    } catch (e) {
        console.warn('[MediaConfig] Failed to load from backend:', e);
    }

    cachedConfig = { ...defaultConfig };
    return cachedConfig;
}

/**
 * Save media config to backend
 */
export async function saveMediaConfig(config: MediaConfig): Promise<void> {
    cachedConfig = config;
    try {
        await invoke('save_media_config', { config: JSON.stringify(config) });
    } catch (e) {
        console.error('[MediaConfig] Failed to save:', e);
        throw e;
    }
}

/**
 * Get all image providers
 */
export async function getImageProviders(): Promise<MediaProvider[]> {
    const config = await loadMediaConfig();
    return config.providers.filter(p => p.mediaTypes.includes('image'));
}

/**
 * Get all video providers
 */
export async function getVideoProviders(): Promise<MediaProvider[]> {
    const config = await loadMediaConfig();
    return config.providers.filter(p => p.mediaTypes.includes('video'));
}

/**
 * Get default image provider
 */
export async function getDefaultImageProvider(): Promise<MediaProvider | undefined> {
    const config = await loadMediaConfig();
    const defaultId = config.defaultImageProvider;
    if (defaultId) {
        return config.providers.find(p => p.id === defaultId);
    }
    // Return first image provider
    return config.providers.find(p => p.mediaTypes.includes('image'));
}

/**
 * Get provider by ID
 */
export async function getMediaProvider(id: string): Promise<MediaProvider | undefined> {
    const config = await loadMediaConfig();
    return config.providers.find(p => p.id === id);
}

/**
 * Invalidate cache
 */
export function invalidateMediaConfigCache(): void {
    cachedConfig = null;
}
