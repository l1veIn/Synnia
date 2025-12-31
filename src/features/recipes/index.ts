// ============================================================================
// Recipe Registry - Entry Point
// V2: Loads recipes from v2/ directory using new flat manifest format
// ============================================================================

import { recipeRegistry as internalRegistry } from './recipeLoader';
import type { RecipeDefinition } from '@/types/recipe';

// Import all V2 YAML files eagerly
const yamlModules = import.meta.glob('./v2/**/*.yaml', {
    eager: true,
    query: '?raw',
    import: 'default'
});

// Build path mapping: recipeId -> directory path segments
const recipePathMap = new Map<string, string[]>();

// Register all V2 YAML recipes
for (const [filePath, content] of Object.entries(yamlModules)) {
    try {
        const recipe = internalRegistry.registerFromYaml(content as string);

        // Extract path from file path: ./v2/agent/naming-master.yaml -> ['agent']
        const pathMatch = filePath.match(/\.\/v2\/(.+)\/[^/]+\.yaml$/);
        if (pathMatch) {
            const pathSegments = pathMatch[1].split('/');
            recipePathMap.set(recipe.id, pathSegments);
        } else {
            // Top-level recipe (e.g., ./v2/llm-call.yaml)
            recipePathMap.set(recipe.id, []);
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
 * Build a tree structure from all registered recipes
 */
export function getRecipeTree(): RecipeTreeNode {
    const root: RecipeTreeNode = {
        type: 'folder',
        name: 'Recipes',
        path: [],
        children: [],
    };

    for (const recipe of internalRegistry.getAll()) {
        const pathSegments = recipePathMap.get(recipe.id) || ['Other'];
        insertIntoTree(root, pathSegments, recipe);
    }

    sortTreeChildren(root);
    return root;
}

function insertIntoTree(
    node: RecipeTreeNode,
    pathSegments: string[],
    recipe: RecipeDefinition
): void {
    if (pathSegments.length === 0) {
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

    node.children.sort((a, b) => {
        if (a.type !== b.type) {
            return a.type === 'folder' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
    });

    for (const child of node.children) {
        if (child.type === 'folder') {
            sortTreeChildren(child);
        }
    }
}

// ============================================================================
// Public API
// ============================================================================

export const recipeRegistry = internalRegistry;
export const getRecipe = (id: string) => internalRegistry.get(id);
export const getResolvedRecipe = (id: string) => internalRegistry.get(id);
export const getAllRecipes = () => internalRegistry.getAll();
export const getRecipesByCategory = () => internalRegistry.getByCategory();
