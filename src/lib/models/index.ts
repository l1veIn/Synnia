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
// Re-export from LLM module (for backward compatibility)
// ============================================================================

export {
    // Registry functions
    llmRegistry,
    getLLMPlugin,
    getAllLLMPlugins,
    getLLMModel,
    getAllLLMModels,
    getLLMModelsForCapability,
    // LLM call function
    callLLM,
    // Types
    type CallLLMOptions,
    type LLMConfigValue,
    type LLMModelDefinition,
} from './llm/registry';

export {
    // Auto-generate (now in shared/)
    autoGenerate,
    type AutoGenerateOptions,
    type AutoGenerateResult,
} from './shared/autoGenerate';

export {
    // Utilities (now at root)
    extractJson,
    repairTruncatedJsonArray,
} from './utils';

// ============================================================================
// Auto-register Models from Provider Directories
// ============================================================================

// OpenAI (LLM + Image)
import { gpt4o, gpt4oMini } from './openai/openai';
import { dallE3 } from './openai/dall-e-3';
modelRegistry.register(gpt4o);
modelRegistry.register(gpt4oMini);
modelRegistry.register(dallE3);

// Google
import { gemini2Flash, gemini25Flash } from './google/google';
modelRegistry.register(gemini2Flash);
modelRegistry.register(gemini25Flash);

// Anthropic
import { claude35Sonnet, claude35Haiku } from './anthropic/anthropic';
modelRegistry.register(claude35Sonnet);
modelRegistry.register(claude35Haiku);

// FAL (Image)
import { fluxSchnell } from './fal/flux-schnell';
import { nanoBananaPro } from './fal/nano-banana-pro';
modelRegistry.register(fluxSchnell);
modelRegistry.register(nanoBananaPro);

// DeepSeek
import { deepseekChat } from './deepseek/deepseek';
modelRegistry.register(deepseekChat);

// Local (Ollama)
import { llama32, llama32Vision } from './local/ollama';
modelRegistry.register(llama32);
modelRegistry.register(llama32Vision);

// Also trigger llmRegistry population (for backward compat with callLLM)
import './llm';

console.log(`[Models] Registered ${modelRegistry.getAll().length} models from provider directories`);

// Re-export types
export * from './types';
