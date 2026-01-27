/**
 * Executor Types
 *
 * Defines the interface for all executors in the system.
 * Executors are responsible for executing recipes based on their type.
 *
 * Following the pattern from ModelRegistry and NodeRegistry.
 */

import { ExecutionContext, ExecutionResult, RecipeManifest } from '@/types/recipe';

// ==========================================
// Executor Interface
// ==========================================

/**
 * Base interface for all executors.
 * Each executor implements a common interface for registration and execution.
 */
export interface Executor {
    /**
     * Executor type identifier (e.g., 'agent', 'http', 'template')
     */
    type: string;

    /**
     * Check if this executor can handle the given manifest.
     * Used for routing to the appropriate executor.
     */
    canHandle(manifest: RecipeManifest): boolean;

    /**
     * Execute the recipe with the given context.
     */
    execute(ctx: ExecutionContext): Promise<ExecutionResult>;
}

// ==========================================
// Registry Interface
// ==========================================

/**
 * Registry interface for managing executors.
 */
export interface ExecutorRegistry {
    /**
     * Register an executor.
     */
    register(executor: Executor): void;

    /**
     * Get an executor by type.
     */
    get(type: string): Executor | undefined;

    /**
     * Get all registered executors.
     */
    getAll(): Executor[];

    /**
     * Find the appropriate executor for a manifest.
     */
    findForManifest(manifest: RecipeManifest): Executor | undefined;
}
