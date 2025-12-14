// ============================================================================
// Recipe Registry - Entry Point
// Auto-loads all recipes from YAML files in builtin/ directory
// ============================================================================

import { recipeRegistry } from './recipeLoader';

// Import all YAML files eagerly using Vite's glob import
const yamlModules = import.meta.glob('./builtin/**/*.yaml', {
    eager: true,
    query: '?raw',
    import: 'default'
});

// Register all YAML recipes
for (const [path, content] of Object.entries(yamlModules)) {
    try {
        recipeRegistry.registerFromYaml(content as string);
        // console.log(`[RecipeRegistry] Loaded: ${path}`);
    } catch (error) {
        console.error(`[RecipeRegistry] Failed to load ${path}:`, error);
    }
}

// Re-export everything from recipeLoader for backward compatibility
export {
    recipeRegistry,
    getRecipe,
    getResolvedRecipe,
    getAllRecipes,
    getRecipesByCategory,
} from './recipeLoader';
