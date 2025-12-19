import { parse as parseYaml } from 'yaml';
import * as LucideIcons from 'lucide-react';
import {
    RecipeManifest,
    RecipeDefinition,
    ManifestField,
    manifestFieldToDefinition,
    ExecutorConfig,
} from '@/types/recipe';
import { FieldDefinition } from '@/types/assets';
import { createExecutor } from './executors';

// ============================================================================
// Recipe Loader - Loads YAML manifests and creates RecipeDefinitions
// ============================================================================

/**
 * Parse YAML content to RecipeManifest
 */
export const parseManifest = (yamlContent: string): RecipeManifest => {
    const raw = parseYaml(yamlContent);

    // Validate required fields
    if (!raw.id) throw new Error('Recipe manifest missing "id"');
    if (!raw.name) throw new Error('Recipe manifest missing "name"');
    if (!raw.inputSchema) throw new Error('Recipe manifest missing "inputSchema"');
    if (!raw.executor) throw new Error('Recipe manifest missing "executor"');

    // Validate version (warn but don't fail for forward compatibility)
    if (raw.version !== 1) {
        console.warn(`[RecipeLoader] Recipe "${raw.id}" has unknown version: ${raw.version}, expected 1`);
    }

    return raw as RecipeManifest;
};

/**
 * Get Lucide icon by name
 */
const getIcon = (iconName?: string): LucideIcons.LucideIcon | undefined => {
    if (!iconName) return undefined;

    // Handle custom icon paths (./icon.svg) - return placeholder
    if (iconName.startsWith('./') || iconName.startsWith('/')) {
        return LucideIcons.FileCode2; // Placeholder for custom icons
    }

    // Look up Lucide icon by name
    const icon = (LucideIcons as any)[iconName];
    return typeof icon === 'function' ? icon : undefined;
};

/**
 * Merge mixin schemas with recipe's own schema
 */
export const mergeSchemas = (
    recipeSchema: ManifestField[],
    mixinSchemas: FieldDefinition[][]
): FieldDefinition[] => {
    const mergedFields = new Map<string, FieldDefinition>();

    // Add mixin fields first
    for (const schema of mixinSchemas) {
        for (const field of schema) {
            mergedFields.set(field.key, field);
        }
    }

    // Override/add recipe's own fields
    for (const field of recipeSchema) {
        const existing = mergedFields.get(field.key);
        if (existing) {
            // Merge with existing (recipe fields override mixin)
            mergedFields.set(field.key, {
                ...existing,
                ...manifestFieldToDefinition(field),
                // Preserve some fields if not explicitly set
                label: field.label ?? existing.label,
            });
        } else {
            mergedFields.set(field.key, manifestFieldToDefinition(field));
        }
    }

    return Array.from(mergedFields.values());
};

/**
 * Create a RecipeDefinition from a manifest
 * This is the main entry point for loading recipes
 */
export const createRecipeFromManifest = (
    manifest: RecipeManifest,
    getMixinRecipe?: (id: string) => RecipeDefinition | undefined
): RecipeDefinition => {
    // Resolve mixin schemas
    const mixinSchemas: FieldDefinition[][] = [];
    if (manifest.mixin && getMixinRecipe) {
        for (const mixinId of manifest.mixin) {
            const mixinRecipe = getMixinRecipe(mixinId);
            if (mixinRecipe) {
                mixinSchemas.push(mixinRecipe.inputSchema);
            }
        }
    }

    // Merge schemas
    const inputSchema = mergeSchemas(manifest.inputSchema, mixinSchemas);

    // Create executor
    const execute = createExecutor(manifest.executor);

    return {
        id: manifest.id,
        name: manifest.name,
        description: manifest.description,
        icon: getIcon(manifest.icon),
        category: manifest.category,
        inputSchema,
        manifest,
        execute,
        mixin: manifest.mixin,
    };
};

// ============================================================================
// Registry - Manages all loaded recipes
// ============================================================================

class RecipeRegistry {
    private recipes = new Map<string, RecipeDefinition>();
    private manifests = new Map<string, RecipeManifest>();

    /**
     * Register a recipe from manifest YAML content
     */
    registerFromYaml(yamlContent: string): RecipeDefinition {
        const manifest = parseManifest(yamlContent);
        return this.registerManifest(manifest);
    }

    /**
     * Register a recipe from a manifest object
     */
    registerManifest(manifest: RecipeManifest): RecipeDefinition {
        this.manifests.set(manifest.id, manifest);

        const recipe = createRecipeFromManifest(
            manifest,
            (id) => this.recipes.get(id)
        );

        this.recipes.set(recipe.id, recipe);
        return recipe;
    }

    /**
     * Register a custom executor recipe (for legacy/complex recipes)
     */
    registerCustom(recipe: RecipeDefinition): void {
        this.recipes.set(recipe.id, recipe);
    }

    /**
     * Get recipe by ID
     */
    get(id: string): RecipeDefinition | undefined {
        return this.recipes.get(id);
    }

    /**
     * Get recipe with mixin resolution (re-resolve mixins)
     */
    getResolved(id: string): RecipeDefinition | undefined {
        const manifest = this.manifests.get(id);
        if (manifest) {
            return createRecipeFromManifest(manifest, (mid) => this.recipes.get(mid));
        }
        return this.recipes.get(id);
    }

    /**
     * Get all recipes
     */
    getAll(): RecipeDefinition[] {
        return Array.from(this.recipes.values());
    }

    /**
     * Get recipes by category
     */
    getByCategory(): Record<string, RecipeDefinition[]> {
        const grouped: Record<string, RecipeDefinition[]> = {};

        for (const recipe of this.recipes.values()) {
            const category = recipe.category || 'Other';
            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push(recipe);
        }

        return grouped;
    }

    /**
     * Check if recipe exists
     */
    has(id: string): boolean {
        return this.recipes.has(id);
    }

    /**
     * Clear all recipes
     */
    clear(): void {
        this.recipes.clear();
        this.manifests.clear();
    }
}

// Global registry instance
export const recipeRegistry = new RecipeRegistry();

// Legacy exports for compatibility
export const getRecipe = (id: string) => recipeRegistry.get(id);
export const getResolvedRecipe = (id: string) => recipeRegistry.getResolved(id);
export const getAllRecipes = () => recipeRegistry.getAll();
export const getRecipesByCategory = () => recipeRegistry.getByCategory();
