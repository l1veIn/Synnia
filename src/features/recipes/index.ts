// ============================================================================
// Recipe Registry - Entry Point
// V1.0: Unified YAML with $ref support
// ============================================================================

import { parse as parseYaml } from 'yaml';
import {
    recipeRegistry as internalRegistry,
    loadRecipePackage,
    type PackageFiles,
} from './recipeLoader';
import type { RecipeDefinition, RecipeManifest } from '@/types/recipe';

// Load Package Files using Vite glob
// ============================================================================

// Single glob for all recipe package files (manifest, schemas, prompts)
const packageFiles = import.meta.glob('./packages/**/*.{yaml,md}', {
    eager: true,
    query: '?raw',
    import: 'default'
}) as Record<string, string>;

// Build path mapping: recipeId -> directory path segments
const recipePathMap = new Map<string, string[]>();

// ============================================================================
// $ref File Loader (uses pre-loaded package files)
// ============================================================================

/**
 * Create a sync file loader that looks up files from pre-loaded modules.
 * All files are eagerly loaded by Vite glob at build time, no async needed.
 */
function createFileLoader(_basePath: string): (path: string) => string {
    return (absolutePath: string): string => {
        // Convert absolute path back to module path format: ./packages/...
        const modulePath = '.' + absolutePath;

        const content = packageFiles[modulePath];
        if (!content) {
            // Try alternative path formats
            const altPath = absolutePath.startsWith('/') ? '.' + absolutePath : './' + absolutePath;
            const altContent = packageFiles[altPath];
            if (!altContent) {
                throw new Error(`File not found: ${absolutePath}\nAvailable: ${Object.keys(packageFiles).slice(0, 5).join(', ')}...`);
            }
            return altContent;
        }
        return content;
    };
}

// ============================================================================
// Register all Package recipes (SYNC - all files pre-loaded by Vite glob)
// ============================================================================

function registerAllRecipes(): void {
    // Filter to only manifest.yaml files
    const manifestModules = Object.entries(packageFiles)
        .filter(([path]) => path.endsWith('/manifest.yaml'));

    for (const [manifestPath, manifestContent] of manifestModules) {
        try {
            // Extract package directory: ./packages/agent/storyteller/manifest.yaml -> ./packages/agent/storyteller
            const packageDir = manifestPath.replace('/manifest.yaml', '');

            const files: PackageFiles = {
                manifest: manifestContent,
                loadFile: createFileLoader(packageDir),
                basePath: packageDir.replace('./', '/'),  // ./packages/agent/art-director -> /packages/agent/art-director
            };
            const manifest = loadRecipePackage(files);
            const recipe = internalRegistry.registerManifest(manifest);

            // Extract path for NodePicker: ./packages/agent/storyteller -> ['agent']
            const pathMatch = packageDir.match(/\.\/packages\/(.+)$/);
            if (pathMatch) {
                const segments = pathMatch[1].split('/');
                const category = segments.slice(0, -1);
                recipePathMap.set(recipe.id, category.length > 0 ? category : [segments[0]]);
            }

            console.log(`[RecipeRegistry] Loaded: ${recipe.id}`);
        } catch (error) {
            console.error(`[RecipeRegistry] Failed to load ${manifestPath}:`, error);
        }
    }
}

// Initialize recipes synchronously (all files pre-loaded by Vite glob)
registerAllRecipes();

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
