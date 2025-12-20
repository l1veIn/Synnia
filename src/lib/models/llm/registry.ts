// LLM Plugin Registry and Utilities
// Central registry for LLM models using Plugin architecture

import { LLMPlugin, LLMExecutionInput, LLMExecutionResult, ProviderCredentials, ProviderType, LLMCapability } from '../types';
import { loadSettings, getApiKey, getBaseUrl } from '@/lib/settings';

// ============================================================================
// LLM Registry
// ============================================================================

class LLMRegistryImpl {
    private plugins = new Map<string, LLMPlugin>();

    register(plugin: LLMPlugin): void {
        if (this.plugins.has(plugin.id)) {
            console.warn(`[LLMRegistry] Plugin ${plugin.id} already registered, overwriting`);
        }
        this.plugins.set(plugin.id, plugin);
    }

    get(id: string): LLMPlugin | undefined {
        return this.plugins.get(id);
    }

    getAll(): LLMPlugin[] {
        return Array.from(this.plugins.values());
    }

    getByProvider(provider: ProviderType): LLMPlugin[] {
        return this.getAll().filter(p => (p.supportedProviders || [p.provider]).includes(provider));
    }

    getByCapability(capability: LLMCapability): LLMPlugin[] {
        return this.getAll().filter(p => p.capabilities?.includes(capability));
    }
}

export const llmRegistry = new LLMRegistryImpl();

// ============================================================================
// Convenience Functions
// ============================================================================

export function getLLMPlugin(id: string): LLMPlugin | undefined {
    return llmRegistry.get(id);
}

export function getAllLLMPlugins(): LLMPlugin[] {
    return llmRegistry.getAll();
}

// Backward compatibility aliases (for LLMConfigurator)
export const getLLMModel = getLLMPlugin;
export const getAllLLMModels = getAllLLMPlugins;
export function getLLMModelsForCapability(capability: LLMCapability): LLMPlugin[] {
    return llmRegistry.getByCapability(capability);
}

// Legacy type aliases
export type LLMModelDefinition = LLMPlugin;
export interface LLMConfigValue {
    modelId: string;
    provider: string;
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
}

// ============================================================================
// Unified LLM Call Function
// ============================================================================

export interface CallLLMOptions {
    modelId?: string;           // Specific model to use
    systemPrompt?: string;
    userPrompt: string;
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
    parseAs?: 'text' | 'json';  // Legacy compatibility
    providerId?: string;        // Legacy - ignored, use modelId
}

/**
 * Call LLM using the new Plugin architecture
 * Automatically gets credentials from Settings
 */
export async function callLLM(options: CallLLMOptions): Promise<LLMExecutionResult> {
    const settings = await loadSettings();

    // Determine which model to use
    const modelId = options.modelId || settings.defaultModels?.['llm-chat'] || 'gpt-4o-mini';
    const plugin = llmRegistry.get(modelId);

    if (!plugin) {
        return {
            success: false,
            error: `LLM model not found: ${modelId}. Available: ${llmRegistry.getAll().map(p => p.id).join(', ')}`
        };
    }

    // Get credentials for the plugin's provider
    const provider = plugin.provider || (plugin.supportedProviders || [])[0];
    const apiKey = getApiKey(provider as any);
    const baseUrl = getBaseUrl(provider as any);

    // Local providers don't need API key
    const isLocalProvider = provider === 'ollama' || provider === 'lmstudio';
    if (!apiKey && !isLocalProvider) {
        return {
            success: false,
            error: `API key not configured for ${provider}. Please configure in Settings.`
        };
    }

    const credentials: ProviderCredentials = {
        apiKey,
        baseUrl,
    };

    // Map parseAs to jsonMode for backward compatibility
    const jsonMode = options.jsonMode ?? (options.parseAs === 'json');

    const input: LLMExecutionInput = {
        systemPrompt: options.systemPrompt,
        userPrompt: options.userPrompt,
        temperature: options.temperature ?? plugin.defaultTemperature ?? 0.7,
        maxTokens: options.maxTokens ?? 2048,
        jsonMode,
        credentials,
    };

    return plugin.execute(input);
}

// ============================================================================
// Re-export types
// ============================================================================

export type { LLMPlugin, LLMExecutionInput, LLMExecutionResult, LLMCapability } from '../types';

