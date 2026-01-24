/**
 * Recipe Loader - V2.0
 * 
 * Simplified loader for backend-resolved manifests.
 * $ref resolution is now handled by the Rust backend.
 */

import * as LucideIcons from 'lucide-react';
import type { RecipeDefinition, RecipeManifest } from '@/types/recipe';
import type { FieldDefinition } from '@/types/assets';
import { ExecutionContext, ExecutionResult } from '@/types/recipe';
import { ModelExecutor } from './executors/ModelExecutor';

// ============================================================================
// Get Lucide Icon from string name
// ============================================================================

function getIcon(iconName?: string): LucideIcons.LucideIcon | undefined {
    if (!iconName) return undefined;
    const icon = (LucideIcons as any)[iconName];
    return typeof icon === 'function' ? icon : undefined;
}

// ============================================================================
// Create RecipeDefinition from Manifest (pre-resolved by backend)
// ============================================================================

/**
 * Create a RecipeDefinition from a manifest.
 * Assumes $ref has already been resolved by the backend.
 */
export function createRecipeFromManifest(manifest: RecipeManifest): RecipeDefinition {
    // Extract input schema - handle both formats:
    // 1. Legacy: manifest.input is array directly
    // 2. V1.0: manifest.input.schema is array
    let inputSchema: FieldDefinition[] = [];
    if (Array.isArray(manifest.input)) {
        inputSchema = manifest.input;
    } else if (manifest.input && typeof manifest.input === 'object' && Array.isArray((manifest.input as any).schema)) {
        inputSchema = (manifest.input as any).schema;
    }

    // Create executor function
    const execute = createExecutor(manifest);

    return {
        id: manifest.id,
        name: manifest.name,
        description: manifest.description,
        icon: getIcon(manifest.icon),
        category: manifest.category,
        inputSchema,
        manifest,
        execute,
    };
}

// ============================================================================
// Executor - Delegates to ModelExecutor
// ============================================================================

function createExecutor(_manifest: RecipeManifest) {
    return async (ctx: ExecutionContext): Promise<ExecutionResult> => {
        // Delegate to ModelExecutor (future: route based on manifest.executor?.type)
        return ModelExecutor.execute(ctx);
    };
}
