// ============================================================================
// Recipe Registry - Entry Point
// V3: Loads recipes from v2/ directory using Package format only
// ============================================================================

import { recipeRegistry as internalRegistry, loadRecipePackage, type PackageFiles } from './recipeLoader';
import type { RecipeDefinition } from '@/types/recipe';

// ============================================================================
// Load Package Files using Vite glob
// ============================================================================

// Import all Package manifest.yaml files
const manifestModules = import.meta.glob('./v2/**/manifest.yaml', {
    eager: true,
    query: '?raw',
    import: 'default'
}) as Record<string, string>;

// Import all schema/prompt files
const inputSchemaModules = import.meta.glob('./v2/**/input.fields.json', {
    eager: true,
    query: '?raw',
    import: 'default'
}) as Record<string, string>;

const outputConfigModules = import.meta.glob('./v2/**/output.config.yaml', {
    eager: true,
    query: '?raw',
    import: 'default'
}) as Record<string, string>;

const outputSchemaModules = import.meta.glob('./v2/**/output.fields.json', {
    eager: true,
    query: '?raw',
    import: 'default'
}) as Record<string, string>;

const systemPromptModules = import.meta.glob('./v2/**/prompts/system.md', {
    eager: true,
    query: '?raw',
    import: 'default'
}) as Record<string, string>;

const userPromptModules = import.meta.glob('./v2/**/prompts/user.md', {
    eager: true,
    query: '?raw',
    import: 'default'
}) as Record<string, string>;

// Build path mapping: recipeId -> directory path segments
const recipePathMap = new Map<string, string[]>();

// ============================================================================
// Register all Package recipes
// ============================================================================

for (const [manifestPath, manifestContent] of Object.entries(manifestModules)) {
    try {
        // Extract package directory: ./v2/agent/storyteller/manifest.yaml -> ./v2/agent/storyteller
        const packageDir = manifestPath.replace('/manifest.yaml', '');

        // Gather all package files
        const files: PackageFiles = {
            manifest: manifestContent,
            inputSchema: inputSchemaModules[`${packageDir}/input.fields.json`],
            outputConfig: outputConfigModules[`${packageDir}/output.config.yaml`],
            outputSchema: outputSchemaModules[`${packageDir}/output.fields.json`],
            systemPrompt: systemPromptModules[`${packageDir}/prompts/system.md`],
            userPrompt: userPromptModules[`${packageDir}/prompts/user.md`],
        };

        // Load and register the recipe
        const manifest = loadRecipePackage(files);
        const recipe = internalRegistry.registerManifest(manifest);

        // Extract path for NodePicker: ./v2/agent/storyteller -> ['agent']
        const pathMatch = packageDir.match(/\.\/v2\/(.+)$/);
        if (pathMatch) {
            // Split path and remove last segment (package name)
            const segments = pathMatch[1].split('/');
            const category = segments.slice(0, -1); // ['agent', 'storyteller'] -> ['agent']
            recipePathMap.set(recipe.id, category.length > 0 ? category : [segments[0]]);
        }

        console.log(`[RecipeRegistry] Loaded package: ${recipe.id}`);
    } catch (error) {
        console.error(`[RecipeRegistry] Failed to load ${manifestPath}:`, error);
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
