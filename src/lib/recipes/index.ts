import { RecipeDefinition } from '@/types/recipe';
import { FieldDefinition } from '@/types/assets';

// ============================================================================
// Recipe Registry
// Auto-discovers all *.recipe.ts files in subdirectories
// ============================================================================

// Auto-load all recipe modules
const modules = import.meta.glob('./**/*.recipe.ts', { eager: true });

export const recipeRegistry: Map<string, RecipeDefinition> = new Map();

// Process and register recipes
for (const [path, mod] of Object.entries(modules)) {
    const definition = (mod as any).definition as RecipeDefinition | undefined;
    if (definition?.id) {
        recipeRegistry.set(definition.id, definition);
        // console.log(`[RecipeRegistry] Loaded: ${definition.id} from ${path}`);
    }
}

/**
 * Get a recipe by ID (raw, without mixin resolution).
 */
export const getRecipe = (id: string): RecipeDefinition | undefined => {
    return recipeRegistry.get(id);
};

/**
 * Get a recipe with mixin schemas merged.
 * Mixin fields come first, then recipe's own fields (can override by key).
 */
export const getResolvedRecipe = (id: string): RecipeDefinition | undefined => {
    const recipe = recipeRegistry.get(id);
    if (!recipe) return undefined;

    // No mixins, return as-is
    if (!recipe.mixin || recipe.mixin.length === 0) {
        return recipe;
    }

    // Collect all mixin schemas (recursively)
    const mergedFields = new Map<string, FieldDefinition>();

    for (const mixinId of recipe.mixin) {
        const mixinRecipe = getResolvedRecipe(mixinId); // Recursive resolution
        if (mixinRecipe) {
            for (const field of mixinRecipe.inputSchema) {
                mergedFields.set(field.key, field);
            }
        }
    }

    // Override with recipe's own fields
    for (const field of recipe.inputSchema) {
        mergedFields.set(field.key, field);
    }

    return {
        ...recipe,
        inputSchema: Array.from(mergedFields.values())
    };
};

/**
 * Get all registered recipes.
 */
export const getAllRecipes = (): RecipeDefinition[] => {
    return Array.from(recipeRegistry.values());
};

/**
 * Get recipes grouped by category.
 */
export const getRecipesByCategory = (): Record<string, RecipeDefinition[]> => {
    const grouped: Record<string, RecipeDefinition[]> = {};

    for (const recipe of recipeRegistry.values()) {
        const category = recipe.category || 'Uncategorized';
        if (!grouped[category]) {
            grouped[category] = [];
        }
        grouped[category].push(recipe);
    }

    return grouped;
};
