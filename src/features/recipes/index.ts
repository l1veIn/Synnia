// ============================================================================
// Recipe Registry - Entry Point
// V2.0: Backend-driven with on-demand loading
// ============================================================================

import type { RecipeDefinition, RecipeManifest } from '@/types/recipe';
import { useRecipeStore, RecipeMeta } from '@/store/recipeStore';
import { createRecipeFromManifest } from './recipeLoader';
import * as LucideIcons from 'lucide-react';
import { LucideIcon, Wand2 } from 'lucide-react';

// ============================================================================
// Internal Registry (for loaded recipes)
// ============================================================================

const loadedRecipes = new Map<string, RecipeDefinition>();

/**
 * Register a recipe from its manifest
 */
export function registerRecipe(manifest: RecipeManifest): RecipeDefinition {
    const recipe = createRecipeFromManifest(manifest);
    loadedRecipes.set(recipe.id, recipe);
    return recipe;
}

/**
 * Get a loaded recipe by ID (may be undefined if not loaded)
 */
export function getRecipe(id: string): RecipeDefinition | undefined {
    return loadedRecipes.get(id);
}

/**
 * Get all loaded recipes
 */
export function getAllRecipes(): RecipeDefinition[] {
    return Array.from(loadedRecipes.values());
}

/**
 * Get loaded recipes grouped by category
 */
export function getRecipesByCategory(): Map<string, RecipeDefinition[]> {
    const byCategory = new Map<string, RecipeDefinition[]>();
    for (const recipe of loadedRecipes.values()) {
        const category = recipe.category || 'Other';
        const list = byCategory.get(category) || [];
        list.push(recipe);
        byCategory.set(category, list);
    }
    return byCategory;
}

// Alias for backward compatibility
export const getResolvedRecipe = getRecipe;

// ============================================================================
// Recipe Tree Structure for NodePicker
// ============================================================================

export interface RecipeTreeNode {
    type: 'folder' | 'recipe';
    name: string;
    path: string[];
    children?: RecipeTreeNode[];
    recipe?: {
        id: string;
        name: string;
        description?: string;
        icon?: LucideIcon;
    };
}

/**
 * Build recipe tree from RecipeStore metas
 */
export function getRecipeTree(): RecipeTreeNode {
    const metas = useRecipeStore.getState().metas;

    const root: RecipeTreeNode = {
        type: 'folder',
        name: 'Recipes',
        path: [],
        children: [],
    };

    for (const meta of metas) {
        // Use category as path, split by / for multi-level support
        // e.g. "品牌设计/简易工具" -> ["品牌设计", "简易工具"]
        const category = meta.category || 'Other';
        const pathSegments = category.split('/').map(s => s.trim()).filter(s => s.length > 0);

        insertIntoTree(root, pathSegments, meta);
    }

    sortTreeChildren(root);
    return root;
}

/**
 * Get recipe path (category-based, supports multi-level with /)
 */
export function getRecipePath(recipeId: string): string[] {
    const metas = useRecipeStore.getState().metas;
    const meta = metas.find(m => m.id === recipeId);
    if (meta?.category) {
        return meta.category.split('/').map(s => s.trim()).filter(s => s.length > 0);
    }
    return ['Other'];
}

function insertIntoTree(
    node: RecipeTreeNode,
    pathSegments: string[],
    meta: RecipeMeta
): void {
    if (pathSegments.length === 0) {
        node.children = node.children || [];
        node.children.push({
            type: 'recipe',
            name: meta.name,
            path: [...node.path],
            recipe: {
                id: meta.id,
                name: meta.name,
                description: meta.description,
                icon: meta.icon ? (LucideIcons as any)[meta.icon] || Wand2 : Wand2,
            },
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

    insertIntoTree(folder, rest, meta);
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
// Re-exports
// ============================================================================

export { createRecipeFromManifest } from './recipeLoader';
export type { RecipeMeta } from '@/store/recipeStore';
