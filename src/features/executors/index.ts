/**
 * Executor Registry
 *
 * Central registry for all executors (agent, http, template, etc.).
 * Following the same pattern as ModelRegistry and NodeRegistry.
 */

import { Executor, ExecutorRegistry } from './types';
import { RecipeManifest } from '@/types/recipe';

// ============================================================================
// Registry Implementation
// ============================================================================

class ExecutorRegistryImpl implements ExecutorRegistry {
    private executors = new Map<string, Executor>();

    register(executor: Executor): void {
        if (this.executors.has(executor.type)) {
            console.warn(`[ExecutorRegistry] Executor ${executor.type} already registered, overwriting`);
        }
        this.executors.set(executor.type, executor);
    }

    get(type: string): Executor | undefined {
        return this.executors.get(type);
    }

    getAll(): Executor[] {
        return Array.from(this.executors.values());
    }

    findForManifest(manifest: RecipeManifest): Executor | undefined {
        // Get executor type from manifest, default to 'agent'
        const executorType = manifest.executor?.type || 'agent';
        return this.get(executorType);
    }
}

// Singleton instance
export const executorRegistry = new ExecutorRegistryImpl();

// ============================================================================
// Convenience Functions
// ============================================================================

export function getExecutor(type: string): Executor | undefined {
    return executorRegistry.get(type);
}

export function getExecutorForManifest(manifest: RecipeManifest): Executor | undefined {
    return executorRegistry.findForManifest(manifest);
}

export function getAllExecutors(): Executor[] {
    return executorRegistry.getAll();
}

// ============================================================================
// Re-export types
// ============================================================================

export * from './types';

// ============================================================================
// Auto-register Executors
// ============================================================================

import { AgentExecutor } from './agent/AgentExecutor';

// Register built-in executors
executorRegistry.register(AgentExecutor);
