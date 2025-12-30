/**
 * Recipe Loader V2 - Loads V2 YAML manifests
 * No mixin inheritance, self-contained recipes
 */

import { parse as parseYaml } from 'yaml';
import * as LucideIcons from 'lucide-react';
import type { RecipeDefinition } from '@/types/recipe';
import type { RecipeManifestV2, ManifestFieldV2, manifestFieldV2ToDefinition } from '@/types/recipeV2';
import { manifestFieldV2ToDefinition as toFieldDef } from '@/types/recipeV2';

// ============================================================================
// Parse YAML to RecipeManifestV2
// ============================================================================

export function parseManifestV2(yamlContent: string): RecipeManifestV2 {
    const raw = parseYaml(yamlContent);

    // Validate version
    if (raw.version !== 2) {
        throw new Error(`Expected version 2, got ${raw.version}`);
    }

    // Validate required fields
    if (!raw.id) throw new Error('Recipe V2 manifest missing "id"');
    if (!raw.name) throw new Error('Recipe V2 manifest missing "name"');
    if (!raw.input) throw new Error('Recipe V2 manifest missing "input"');
    if (!raw.model) throw new Error('Recipe V2 manifest missing "model"');
    if (!raw.prompt) throw new Error('Recipe V2 manifest missing "prompt"');
    if (!raw.output) throw new Error('Recipe V2 manifest missing "output"');

    return raw as RecipeManifestV2;
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
// Create RecipeDefinition from V2 Manifest
// ============================================================================

export function createRecipeFromManifestV2(manifest: RecipeManifestV2): RecipeDefinition {
    // Convert input fields to FieldDefinitions
    const inputSchema = manifest.input.map(toFieldDef);

    // Create executor function
    const execute = createV2Executor(manifest);

    // Build manifest with V2 model info preserved
    const v1Manifest = {
        version: 1 as const,
        id: manifest.id,
        name: manifest.name,
        description: manifest.description,
        category: manifest.category,
        icon: manifest.icon,
        inputSchema: manifest.input as any,
        // Preserve V2 model requirements for capability checking
        model: manifest.model,
        executor: {
            type: 'llm-agent',
            systemPrompt: manifest.prompt.system,
            userPromptTemplate: manifest.prompt.user,
            parseAs: manifest.output.format === 'json' ? 'json' : 'text',
            output: manifest.output.node ? {
                node: manifest.output.node,
                title: manifest.output.title,
                collapsed: manifest.output.collapsed,
                config: manifest.output.config,  // Universal Output Adapter
            } : undefined,
        },
    };

    return {
        id: manifest.id,
        name: manifest.name,
        description: manifest.description,
        icon: getIcon(manifest.icon),
        category: manifest.category,
        inputSchema,
        manifest: v1Manifest as any,
        execute,
    };
}

// ============================================================================
// V2 Executor - Uses V2 manifest directly
// ============================================================================

import { ExecutionContext, ExecutionResult } from '@/types/recipe';
import { callLLM } from '@features/models';
import { interpolate } from './executors/utils';
import { extractJson } from '@features/models/utils';

function createV2Executor(manifest: RecipeManifestV2) {
    return async (ctx: ExecutionContext): Promise<ExecutionResult> => {
        const { inputs, modelConfig, chatContext } = ctx;

        // Determine model to use
        const modelId = modelConfig?.modelId;
        if (!modelId) {
            return { success: false, error: 'No model selected' };
        }

        // Build system prompt (supports {{variables}})
        const systemPrompt = interpolate(manifest.prompt.system, inputs);

        // Build user prompt (first turn only if no chat context)
        let userPrompt: string;
        if (chatContext && chatContext.length > 0) {
            // Multi-turn: use last user message or inputs
            const lastUserMsg = [...chatContext].reverse().find(m => m.role === 'user');
            userPrompt = lastUserMsg?.content || interpolate(manifest.prompt.user, inputs);
        } else {
            // First turn: use template
            userPrompt = interpolate(manifest.prompt.user, inputs);
        }

        // Call LLM
        const llmResult = await callLLM({
            modelId,
            userPrompt,
            systemPrompt,
            temperature: modelConfig?.params?.temperature ?? manifest.model.defaultParams?.temperature,
            maxTokens: modelConfig?.params?.maxTokens ?? manifest.model.defaultParams?.maxTokens,
            jsonMode: manifest.output.format === 'json' && (modelConfig?.params?.jsonMode !== false),
        });

        if (!llmResult.success) {
            return { success: false, error: llmResult.error };
        }

        // Parse output
        let data: any;
        if (manifest.output.format === 'json') {
            const parsed = extractJson(llmResult.text || '');
            if (!parsed.success) {
                return { success: false, error: 'Failed to parse JSON response' };
            }
            data = parsed.data;
        } else {
            // Text/markdown: use raw text
            data = llmResult.text || '';
        }

        return { success: true, data };
    };
}

// ============================================================================
// Registry for V2 Recipes
// ============================================================================

class RecipeRegistryV2 {
    private recipes = new Map<string, RecipeDefinition>();
    private manifests = new Map<string, RecipeManifestV2>();

    registerFromYaml(yamlContent: string): RecipeDefinition {
        const manifest = parseManifestV2(yamlContent);
        return this.registerManifest(manifest);
    }

    registerManifest(manifest: RecipeManifestV2): RecipeDefinition {
        this.manifests.set(manifest.id, manifest);
        const recipe = createRecipeFromManifestV2(manifest);
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

export const recipeRegistryV2 = new RecipeRegistryV2();

// Convenience exports
export const getRecipeV2 = (id: string) => recipeRegistryV2.get(id);
export const getAllRecipesV2 = () => recipeRegistryV2.getAll();
export const getRecipesByCategoryV2 = () => recipeRegistryV2.getByCategory();
