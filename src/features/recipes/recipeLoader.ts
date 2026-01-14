/**
 * Recipe Loader - Loads Recipe Package files (manifest.yaml + JSON files)
 * V2 Architecture: Self-contained recipes, no mixin inheritance
 */

import { parse as parseYaml } from 'yaml';
import * as LucideIcons from 'lucide-react';
import type { RecipeDefinition, RecipeManifest } from '@/types/recipe';
import type { FieldDefinition } from '@/types/assets';

// ============================================================================
// Parse YAML to RecipeManifest (from string content)
// ============================================================================

export function parseManifest(yamlContent: string): RecipeManifest {
    const raw = parseYaml(yamlContent);

    // Validate version
    if (raw.version !== 2) {
        throw new Error(`Expected version 2, got ${raw.version}`);
    }

    // Validate required fields
    if (!raw.id) throw new Error('Recipe V2 manifest missing "id"');
    if (!raw.name) throw new Error('Recipe V2 manifest missing "name"');
    if (!raw.model) throw new Error('Recipe V2 manifest missing "model"');
    // output is optional in Package mode (loaded from output.config.yaml)

    // input and prompt are optional in Package mode (loaded from separate files)
    return raw as RecipeManifest;
}

// ============================================================================
// Load Recipe Package (from separate files)
// ============================================================================

export interface PackageFiles {
    manifest: string;                  // manifest.yaml content
    input?: string;                    // input.json content { schema: FieldDefinition[] }
    output?: string;                   // output.json content { node, title, collapsed, schema }
    systemPrompt?: string;             // prompts/system.md content
    userPrompt?: string;               // prompts/user.md content
}

export function loadRecipePackage(files: PackageFiles): RecipeManifest {
    const manifest = parseManifest(files.manifest);

    // Load input from unified input.json
    if (files.input) {
        const inputData = JSON.parse(files.input);
        // Support both formats: { schema: [...] } or legacy [...]
        manifest.input = Array.isArray(inputData) ? inputData : inputData.schema;
    }

    // Load prompts from separate files
    if (files.systemPrompt || files.userPrompt) {
        manifest.prompt = {
            system: files.systemPrompt || '',
            user: files.userPrompt || '',
        };
    }

    // Load output from unified output.json
    if (files.output) {
        const outputData = JSON.parse(files.output);
        // Merge all output properties
        manifest.output = {
            ...manifest.output,
            ...outputData,
        };
    }

    return manifest;
}

// ============================================================================
// Get Lucide Icon
// ============================================================================

function getIcon(iconName?: string): LucideIcons.LucideIcon | undefined {
    if (!iconName) return undefined;
    const icon = (LucideIcons as any)[iconName];
    return typeof icon === 'function' ? icon : undefined;
}

// ============================================================================
// Create RecipeDefinition from V2 Manifest
// ============================================================================

export function createRecipeFromManifest(manifest: RecipeManifest): RecipeDefinition {
    // Input schema is already in FieldDefinition format from JSON Package files
    const inputSchema: FieldDefinition[] = (manifest.input as FieldDefinition[]) || [];

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
// V2 Executor - Uses new Executor Plugin System
// ============================================================================

import { ExecutionContext, ExecutionResult } from '@/types/recipe';
import { ModelExecutor } from './executors/ModelExecutor';

function createExecutor(manifest: RecipeManifest) {
    return async (ctx: ExecutionContext): Promise<ExecutionResult> => {
        // Delegate to ModelExecutor (future: route based on manifest.executor?.type)
        return ModelExecutor.execute(ctx);
    };
}


// ============================================================================
// Registry for V2 Recipes
// ============================================================================

class RecipeRegistry {
    private recipes = new Map<string, RecipeDefinition>();
    private manifests = new Map<string, RecipeManifest>();

    registerFromYaml(yamlContent: string): RecipeDefinition {
        const manifest = parseManifest(yamlContent);
        return this.registerManifest(manifest);
    }

    registerManifest(manifest: RecipeManifest): RecipeDefinition {
        this.manifests.set(manifest.id, manifest);
        const recipe = createRecipeFromManifest(manifest);
        this.recipes.set(recipe.id, recipe);
        return recipe;
    }

    get(id: string): RecipeDefinition | undefined {
        return this.recipes.get(id);
    }

    getAll(): RecipeDefinition[] {
        return Array.from(this.recipes.values());
    }

    getByCategory(): Record<string, RecipeDefinition[]> {
        const grouped: Record<string, RecipeDefinition[]> = {};
        for (const recipe of this.recipes.values()) {
            const category = recipe.category || 'Other';
            if (!grouped[category]) grouped[category] = [];
            grouped[category].push(recipe);
        }
        return grouped;
    }

    has(id: string): boolean {
        return this.recipes.has(id);
    }

    clear(): void {
        this.recipes.clear();
        this.manifests.clear();
    }
}

export const recipeRegistry = new RecipeRegistry();
