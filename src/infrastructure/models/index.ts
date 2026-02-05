// Model Plugin Registry
// Central registry for all model plugins (LLM + Media unified)

import { ModelPlugin, ModelCategory, ModelCapability, ModelRegistry } from './types';

// ============================================================================
// Registry Implementation
// ============================================================================

class ModelRegistryImpl implements ModelRegistry {
    models = new Map<string, ModelPlugin>();

    register(model: ModelPlugin): void {
        if (this.models.has(model.id)) {
            console.warn(`[ModelRegistry] Model ${model.id} already registered, overwriting`);
        }
        this.models.set(model.id, model);
    }

    get(id: string): ModelPlugin | undefined {
        return this.models.get(id);
    }

    getByCategory(category: ModelCategory): ModelPlugin[] {
        return Array.from(this.models.values()).filter(m => m.category === category);
    }

    getByCapabilities(category: ModelCategory, caps: ModelCapability[]): ModelPlugin[] {
        return this.getByCategory(category).filter(m =>
            caps.every(cap => m.capabilities?.includes(cap))
        );
    }

    getAll(): ModelPlugin[] {
        return Array.from(this.models.values());
    }
}

// Singleton instance
export const modelRegistry = new ModelRegistryImpl();

// ============================================================================
// Convenience Functions
// ============================================================================

export function getModel(id: string): ModelPlugin | undefined {
    return modelRegistry.get(id);
}

export function getModelsForCategory(category: ModelCategory): ModelPlugin[] {
    return modelRegistry.getByCategory(category);
}

export function getModelsWithCapabilities(category: ModelCategory, caps: ModelCapability[]): ModelPlugin[] {
    return modelRegistry.getByCapabilities(category, caps);
}

export function getAllModels(): ModelPlugin[] {
    return modelRegistry.getAll();
}

// ============================================================================
// Provider Registry (from backend - single source of truth)
// ============================================================================

/**
 * Provider information from backend.
 * This is the single source of truth for which providers Synnia supports.
 */
export interface BackendProviderInfo {
    key: string;
    name: string;
    description: string;
    providerType: 'cloud' | 'local';
    placeholder: string;
    defaultBaseUrl?: string;
    requiresApiKey: boolean;
}

let cachedAllProviders: BackendProviderInfo[] | null = null;

/**
 * Get all supported providers from backend.
 * This is the single source of truth.
 */
export async function getAllProviders(): Promise<BackendProviderInfo[]> {
    if (cachedAllProviders !== null) {
        return cachedAllProviders;
    }

    try {
        const { invoke } = await import('@tauri-apps/api/core');
        const providers = await invoke<BackendProviderInfo[]>('get_all_providers_command');
        cachedAllProviders = providers;
        return providers;
    } catch (error) {
        console.error('[Models] Failed to get all providers:', error);
        return [];
    }
}

/**
 * Refresh the cached providers.
 * Call this after provider configuration changes.
 */
export function refreshAllProviders(): void {
    cachedAllProviders = null;
}

// ============================================================================
// Available Models (filtered by configured providers)
// ============================================================================

/**
 * Get list of providers that have API keys configured in the backend.
 * Caches the result for the session.
 */
let cachedAvailableProviders: string[] | null = null;

export async function getAvailableProviders(): Promise<string[]> {
    if (cachedAvailableProviders !== null) {
        return cachedAvailableProviders;
    }

    try {
        const { invoke } = await import('@tauri-apps/api/core');
        const providers = await invoke<string[]>('get_available_providers_command');
        cachedAvailableProviders = providers;
        return providers;
    } catch (error) {
        console.error('[Models] Failed to get available providers:', error);
        return [];
    }
}

/**
 * Refresh the cached available providers.
 * Call this after API key changes.
 */
export function refreshAvailableProviders(): void {
    cachedAvailableProviders = null;
}

/**
 * Get models that are available (their provider has API key configured).
 */
export async function getAvailableModels(category?: ModelCategory): Promise<ModelPlugin[]> {
    const providers = await getAvailableProviders();

    const models = category
        ? modelRegistry.getByCategory(category)
        : modelRegistry.getAll();
    console.log('[Models] Available providers:', providers);
    console.log('[Models] All models:', models);
    // Filter to only models from available providers
    return models.filter(model => providers.includes(model.provider));
}

/**
 * Check if a specific provider is available (has API key configured).
 */
export async function isProviderAvailable(provider: string): Promise<boolean> {
    const providers = await getAvailableProviders();
    return providers.includes(provider);
}

// ============================================================================
// New Default LLM API (unified)
// ============================================================================

export { callDefaultLLM, callLLM, type CallDefaultLLMOptions } from './shared/callDefaultLLM';
export { useDefaultLLM, type UseDefaultLLMReturn, type UseDefaultLLMOptions } from './hooks';
export { autoGenerate, type AutoGenerateOptions, type AutoGenerateResult } from './shared/autoGenerate';
export { extractJson, repairTruncatedJsonArray } from './utils';

// Re-export types
export * from './types';

// ============================================================================
// Auto-register Models from Provider Directories
// ============================================================================

// OpenAI (LLM + Image)
import { gpt4o, gpt4oMini } from './openai/openai';
import { dallE3 } from './openai/dall-e-3';
modelRegistry.register(gpt4o);
modelRegistry.register(gpt4oMini);
modelRegistry.register(dallE3);

// Google (LLM + Image)
import { gemini2Flash, gemini25Flash, gemini3Pro, gemini3Flash } from './google/google';
import { geminiImage } from './google/gemini-image';
modelRegistry.register(gemini2Flash);
modelRegistry.register(gemini25Flash);
modelRegistry.register(gemini3Pro);
modelRegistry.register(gemini3Flash);
modelRegistry.register(geminiImage);

// Anthropic
import { claude35Sonnet, claude35Haiku } from './anthropic/anthropic';
modelRegistry.register(claude35Sonnet);
modelRegistry.register(claude35Haiku);

// FAL (Image)
import { fluxSchnell } from './fal/flux-schnell';
import { falNanoBanana } from './fal/fal-nano-banana';
modelRegistry.register(fluxSchnell);
modelRegistry.register(falNanoBanana);

// DeepSeek
import { deepseekChat } from './deepseek/deepseek';
modelRegistry.register(deepseekChat);

// Zhipu (GLM LLM)
import { glm47, glm46v, glm4Flash, glm47Flash } from './zhipu/zhipu';
modelRegistry.register(glm47);
modelRegistry.register(glm46v);
modelRegistry.register(glm4Flash);
modelRegistry.register(glm47Flash);

// Zhipu (GLM Image)
import { glmImage, cogview4, cogview3Flash } from './zhipu/zhipu-image';
modelRegistry.register(glmImage);
modelRegistry.register(cogview4);
modelRegistry.register(cogview3Flash);

// Local (Ollama, g4f)
import { llama32, llama32Vision } from './local/ollama';
import { g4fGeminiImage } from './local/g4f-gemini-image';
modelRegistry.register(llama32);
modelRegistry.register(llama32Vision);
modelRegistry.register(g4fGeminiImage);

