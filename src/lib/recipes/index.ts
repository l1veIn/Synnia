import { RecipeDefinition } from '@/types/recipe';

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
 * Get a recipe by ID.
 */
export const getRecipe = (id: string): RecipeDefinition | undefined => {
    return recipeRegistry.get(id);
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
