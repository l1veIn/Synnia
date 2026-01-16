/**
 * Recipe Loader - Unified YAML with $ref Support
 *
 * Architecture:
 * - Single manifest.yaml contains all configuration
 * - $ref to external .yaml schema files (relative paths only)
 * - Circular reference detection
 * - Detailed dependency error reporting
 */

import { parse as parseYaml } from 'yaml';
import * as LucideIcons from 'lucide-react';
import type { RecipeDefinition, RecipeManifest } from '@/types/recipe';
import type { FieldDefinition } from '@/types/assets';

// ============================================================================
// $ref Resolution
// ============================================================================

type RefCache = Map<string, any>;

interface ResolveContext {
    basePath: string;
    visitedPaths: Set<string>;
    cache: RefCache;
    loadFile: (path: string) => string;  // Sync: files pre-loaded by Vite glob
}

/**
 * Resolve all $ref in an object recursively.
 * Tracks visited paths to detect circular references.
 * SYNC: All files are pre-loaded by Vite glob.
 */
function resolveRefs<T>(obj: T, ctx: ResolveContext): T {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => resolveRefs(item, ctx)) as T;
    }

    const record = obj as Record<string, any>;

    // Check for $ref
    if ('$ref' in record && typeof record.$ref === 'string') {
        const refPath = record.$ref;

        // Resolve relative path
        const absolutePath = resolveRelativePath(ctx.basePath, refPath);

        // Check circular reference
        if (ctx.visitedPaths.has(absolutePath)) {
            throw new Error(
                `Circular reference detected: ${absolutePath}\n` +
                `Reference chain: ${Array.from(ctx.visitedPaths).join(' → ')} → ${absolutePath}`
            );
        }

        // Check cache
        if (ctx.cache.has(absolutePath)) {
            return ctx.cache.get(absolutePath);
        }

        // Load and parse referenced file
        let content: string;
        try {
            content = ctx.loadFile(absolutePath);
        } catch (error) {
            throw new Error(
                `Failed to load $ref: ${refPath}\n` +
                `Resolved path: ${absolutePath}\n` +
                `Original error: ${error instanceof Error ? error.message : error}`
            );
        }

        let parsed: any;
        try {
            parsed = parseYaml(content);
        } catch (error) {
            throw new Error(
                `Failed to parse YAML in $ref: ${refPath}\n` +
                `Original error: ${error instanceof Error ? error.message : error}`
            );
        }

        // Recursively resolve refs in loaded content
        const newCtx: ResolveContext = {
            ...ctx,
            basePath: getDirectory(absolutePath),
            visitedPaths: new Set([...ctx.visitedPaths, absolutePath]),
        };

        const resolved = resolveRefs(parsed, newCtx);
        ctx.cache.set(absolutePath, resolved);
        return resolved;
    }

    // Recursively process all properties
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(record)) {
        result[key] = resolveRefs(value, ctx);
    }

    return result as T;
}

/**
 * Resolve relative path from base directory.
 */
function resolveRelativePath(basePath: string, relativePath: string): string {
    // Handle ../ and ./
    const parts = basePath.split('/').filter(Boolean);
    const relParts = relativePath.split('/').filter(Boolean);

    for (const part of relParts) {
        if (part === '..') {
            parts.pop();
        } else if (part !== '.') {
            parts.push(part);
        }
    }

    return '/' + parts.join('/');
}

/**
 * Get directory from file path.
 */
function getDirectory(filePath: string): string {
    const parts = filePath.split('/');
    parts.pop();
    return parts.join('/') || '/';
}

// ============================================================================
// Parse YAML to RecipeManifest (from string content)
// ============================================================================

export function parseManifest(yamlContent: string): RecipeManifest {
    const raw = parseYaml(yamlContent);

    // Require version 1 (unified YAML format)
    if (raw.version !== 1) {
        throw new Error(`Expected version 1, got ${raw.version}`);
    }

    // Validate required fields
    if (!raw.id) throw new Error('Recipe manifest missing "id"');
    if (!raw.name) throw new Error('Recipe manifest missing "name"');
    if (!raw.model) throw new Error('Recipe manifest missing "model"');

    return raw as RecipeManifest;
}

// ============================================================================
// Load Recipe Package (unified YAML with $ref)
// ============================================================================

export interface PackageFiles {
    manifest: string;           // manifest.yaml content (may contain $ref)
    systemPrompt?: string;      // prompts/system.md content
    userPrompt?: string;        // prompts/user.md content
    loadFile: (path: string) => string;  // Sync: files pre-loaded by Vite glob
    basePath: string;           // Base path for resolving $ref
}

export function loadRecipePackage(files: PackageFiles): RecipeManifest {
    const manifest = parseManifest(files.manifest);

    // Create resolve context
    const ctx: ResolveContext = {
        basePath: files.basePath,
        visitedPaths: new Set(),
        cache: new Map(),
        loadFile: files.loadFile,
    };

    // Resolve all $ref in input.schema
    if (manifest.input) {
        const inputDef = manifest.input as any;
        if (inputDef.schema) {
            // Unified format: { schema: $ref or array }
            const resolvedSchema = resolveRefs(inputDef.schema, ctx);
            // Flatten to array for compatibility with existing code
            manifest.input = resolvedSchema;
        }
    }

    // Resolve all $ref in output schema
    if (manifest.output?.schema) {
        manifest.output.schema = resolveRefs(manifest.output.schema, ctx);
    }

    // Load prompts from separate files (kept as-is for readability)
    if (files.systemPrompt || files.userPrompt) {
        manifest.prompt = {
            system: files.systemPrompt || '',
            user: files.userPrompt || '',
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
// Create RecipeDefinition from Manifest
// ============================================================================

export function createRecipeFromManifest(manifest: RecipeManifest): RecipeDefinition {
    // Input schema is already in FieldDefinition format
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
// Executor - Uses Executor Plugin System
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
// Registry for Recipes
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
