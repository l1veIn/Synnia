// Model Plugin Registry
// Central registry for all model plugins

import { ModelPlugin, ModelCategory, ModelRegistry } from './types';

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

export function getAllModels(): ModelPlugin[] {
    return modelRegistry.getAll();
}

// ============================================================================
// Auto-register Models
// ============================================================================

// Import and register all models
import { nanoBananaPro } from './media/nano-banana-pro';
import { fluxSchnell } from './media/flux-schnell';
import { dallE3 } from './media/dall-e-3';

// Register models
modelRegistry.register(nanoBananaPro);
modelRegistry.register(fluxSchnell);
modelRegistry.register(dallE3);

// Re-export types
export * from './types';
