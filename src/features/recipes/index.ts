// ============================================================================
// Recipe Registry - Entry Point
// Auto-loads all recipes from YAML files in builtin/ directory
// ============================================================================

import { recipeRegistry } from './recipeLoader';
import type { RecipeDefinition } from '@/types/recipe';

// Import all YAML files eagerly using Vite's glob import
const yamlModules = import.meta.glob('./builtin/**/*.yaml', {
    eager: true,
    query: '?raw',
    import: 'default'
});

// Build path mapping: recipeId -> directory path segments
const recipePathMap = new Map<string, string[]>();

// Register all YAML recipes and track their paths
for (const [filePath, content] of Object.entries(yamlModules)) {
    try {
        const recipe = recipeRegistry.registerFromYaml(content as string);

        // Extract path from file path: ./builtin/agent/rag/retriever.yaml -> ['agent', 'rag']
        const pathMatch = filePath.match(/\.\/builtin\/(.+)\/[^/]+\.yaml$/);
        if (pathMatch) {
            const pathSegments = pathMatch[1].split('/');
            recipePathMap.set(recipe.id, pathSegments);
        }
    } catch (error) {
        console.error(`[RecipeRegistry] Failed to load ${filePath}:`, error);
    }
}

// ============================================================================
// Recipe Tree Structure for NodePicker
// ============================================================================

export interface RecipeTreeNode {
    type: 'folder' | 'recipe';
    name: string;
    path: string[];
    children?: RecipeTreeNode[];
    recipe?: RecipeDefinition;
}

/**
 * Get the directory path for a recipe
 */
export function getRecipePath(recipeId: string): string[] {
    return recipePathMap.get(recipeId) || [];
}

/**
 * Build a tree structure from all registered recipes based on their directory paths
 */
export function getRecipeTree(): RecipeTreeNode {
    const root: RecipeTreeNode = {
        type: 'folder',
        name: 'Recipes',
        path: [],
        children: [],
    };

    for (const recipe of recipeRegistry.getAll()) {
        const pathSegments = recipePathMap.get(recipe.id) || ['Other'];
        insertIntoTree(root, pathSegments, recipe);
    }

    // Sort children alphabetically (folders first, then recipes)
    sortTreeChildren(root);

    return root;
}

function insertIntoTree(
    node: RecipeTreeNode,
    pathSegments: string[],
    recipe: RecipeDefinition
): void {
    if (pathSegments.length === 0) {
        // At target level, add recipe
        node.children = node.children || [];
        node.children.push({
            type: 'recipe',
            name: recipe.name,
            path: [...node.path],
            recipe,
        });
        return;
    }

    const [segment, ...rest] = pathSegments;
    node.children = node.children || [];

    // Find or create folder
    let folder = node.children.find(
        (child) => child.type === 'folder' && child.name === segment
    );

    if (!folder) {
        folder = {
            type: 'folder',
            name: segment,
            path: [...node.path, segment],
            children: [],
        };
        node.children.push(folder);
    }

    insertIntoTree(folder, rest, recipe);
}

function sortTreeChildren(node: RecipeTreeNode): void {
    if (!node.children) return;

    // Sort: folders first (alphabetically), then recipes (alphabetically)
    node.children.sort((a, b) => {
        if (a.type !== b.type) {
            return a.type === 'folder' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
    });

    // Recursively sort children
    for (const child of node.children) {
        if (child.type === 'folder') {
            sortTreeChildren(child);
        }
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
