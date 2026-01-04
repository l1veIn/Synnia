/**
 * Recipe Loader - Loads YAML manifests
 * Self-contained recipes, no mixin inheritance
 */

import { parse as parseYaml } from 'yaml';
import * as LucideIcons from 'lucide-react';
import type { RecipeDefinition, RecipeManifest } from '@/types/recipe';
import type { FieldDefinition } from '@/types/assets';
import type { WidgetType } from '@/types/widgets';

// Conversion function (internal to loader)
function yamlToFieldDef(field: any): FieldDefinition {
    const nestedSchema = field.schema?.map(yamlToFieldDef);
    return {
        key: field.key,
        label: field.label,
        type: field.type === 'select' ? 'string' : field.type,
        widget: field.type === 'select' ? 'select' : (field.widget as WidgetType | undefined),
        required: field.required,
        defaultValue: field.default,
        config: {
            options: field.options,
            placeholder: field.placeholder,
        },
        connection: field.connection,
        schema: nestedSchema,
    };
}

// ============================================================================
// Parse YAML to RecipeManifest (from string content)
// ============================================================================

export function parseManifest(yamlContent: string): RecipeManifest {
    const raw = parseYaml(yamlContent);

    // Validate version
    if (raw.version !== 2) {
        throw new Error(`Expected version 2, got ${raw.version}`);
    }

    // Validate required fields
    if (!raw.id) throw new Error('Recipe V2 manifest missing "id"');
    if (!raw.name) throw new Error('Recipe V2 manifest missing "name"');
    if (!raw.model) throw new Error('Recipe V2 manifest missing "model"');
    // output is optional in Package mode (loaded from output.config.yaml)

    // input and prompt are optional in Package mode (loaded from separate files)
    return raw as RecipeManifest;
}

// ============================================================================
// Load Recipe Package (from separate files)
// ============================================================================

export interface PackageFiles {
    manifest: string;                  // manifest.yaml content
    inputSchema?: string;              // input.schema.json content
    outputConfig?: string;             // output.config.yaml content
    outputSchema?: string;             // output.schema.json content
    systemPrompt?: string;             // prompts/system.md content
    userPrompt?: string;               // prompts/user.md content
}

export function loadRecipePackage(files: PackageFiles): RecipeManifest {
    const manifest = parseManifest(files.manifest);

    // Load input schema from separate file
    if (files.inputSchema) {
        const inputFields = JSON.parse(files.inputSchema);
        manifest.input = inputFields;
    }

    // Load prompts from separate files
    if (files.systemPrompt || files.userPrompt) {
        manifest.prompt = {
            system: files.systemPrompt || '',
            user: files.userPrompt || '',
        };
    }

    // Load output config from separate file
    if (files.outputConfig) {
        const outputConfig = parseYaml(files.outputConfig);
        manifest.output = {
            ...manifest.output,
            ...outputConfig,
        };
    }

    // Load output schema from separate file
    if (files.outputSchema) {
        const outputFields = JSON.parse(files.outputSchema);
        manifest.output = manifest.output || {} as any;
        manifest.output.schema = outputFields;
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
// Create RecipeDefinition from V2 Manifest
// ============================================================================

export function createRecipeFromManifest(manifest: RecipeManifest): RecipeDefinition {
    // Convert input fields to FieldDefinitions
    const inputSchema = manifest.input?.map(yamlToFieldDef) || [];

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
// V2 Executor - Uses V2 manifest directly
// ============================================================================

import { ExecutionContext, ExecutionResult } from '@/types/recipe';
import { callLLM } from '@features/models';
import { interpolate } from './executors/utils';
import { extractJson } from '@features/models/utils';

function createExecutor(manifest: RecipeManifest) {
    return async (ctx: ExecutionContext): Promise<ExecutionResult> => {
        const { inputs, modelConfig } = ctx;

        // Determine model to use
        const modelId = modelConfig?.modelId;
        if (!modelId) {
            return { success: false, error: 'No model selected' };
        }

        // Route by model category
        const category = manifest.model.category;

        if (category === 'image-generation' || category === 'video-generation') {
            // Media execution path
            return executeMedia(manifest, ctx, modelId);
        } else {
            // LLM execution path (default)
            return executeLLM(manifest, ctx, modelId);
        }
    };
}

// ============================================================================
// LLM Execution
// ============================================================================

async function executeLLM(
    manifest: RecipeManifest,
    ctx: ExecutionContext,
    modelId: string
): Promise<ExecutionResult> {
    const { inputs, modelConfig, chatContext } = ctx;

    // Build system prompt (supports {{variables}})
    const systemPrompt = interpolate(manifest.prompt?.system || '', inputs);

    // Build user prompt (first turn only if no chat context)
    let userPrompt: string;
    if (chatContext && chatContext.length > 0) {
        // Multi-turn: use last user message or inputs
        const lastUserMsg = [...chatContext].reverse().find(m => m.role === 'user');
        userPrompt = lastUserMsg?.content || interpolate(manifest.prompt?.user || '', inputs);
    } else {
        // First turn: use template
        userPrompt = interpolate(manifest.prompt?.user || '', inputs);
    }

    // Call LLM
    // JSON mode: all nodes except 'text' expect JSON output
    const isTextOutput = manifest.output.node === 'text';

    // Call LLM
    const llmResult = await callLLM({
        modelId,
        userPrompt,
        systemPrompt,
        temperature: modelConfig?.params?.temperature ?? manifest.model.defaultParams?.temperature,
        maxTokens: modelConfig?.params?.maxTokens ?? manifest.model.defaultParams?.maxTokens,
        jsonMode: !isTextOutput && (modelConfig?.params?.jsonMode !== false),
    });

    if (!llmResult.success) {
        return { success: false, error: llmResult.error };
    }

    // Parse output
    let data: any;
    if (!isTextOutput) {
        // All non-text nodes expect JSON
        const parsed = extractJson(llmResult.text || '');
        if (!parsed.success) {
            return { success: false, error: 'Failed to parse JSON response' };
        }
        data = parsed.data;
    } else {
        // Text node: use raw text
        data = llmResult.text || '';
    }

    return { success: true, data };
}

// ============================================================================
// Media Execution (Image/Video Generation)
// ============================================================================

async function executeMedia(
    manifest: RecipeManifest,
    ctx: ExecutionContext,
    modelId: string
): Promise<ExecutionResult> {
    const { inputs, modelConfig } = ctx;

    try {
        // Get the model plugin
        const { getModel } = await import('@features/models');
        const modelPlugin = getModel(modelId);
        if (!modelPlugin) {
            return { success: false, error: `Model not found: ${modelId}` };
        }

        // Get credentials from settings
        const { getSettings, getProviderCredentials } = await import('@/lib/settings');
        const settings = getSettings();
        const provider = (modelConfig?.provider || modelPlugin.provider || (modelPlugin.supportedProviders || [])[0]) as import('@/lib/settings/types').ProviderKey;
        const credentials = getProviderCredentials(settings, provider);

        if (!credentials?.apiKey && !credentials?.baseUrl) {
            return { success: false, error: `No credentials configured for ${provider}` };
        }

        // Extract inputs
        const prompt = inputs.prompt || '';
        const negativePrompt = inputs.negativePrompt;
        const images = inputs.image ? [inputs.image] : undefined;

        // Execute via model plugin
        const modelResult = await modelPlugin.execute({
            config: modelConfig?.params,
            prompt,
            negativePrompt,
            images,
            credentials: {
                apiKey: credentials.apiKey || '',
                baseUrl: credentials.baseUrl,
            },
        });

        if (!modelResult.success) {
            return { success: false, error: modelResult.error };
        }

        // Handle image output - prepare gallery data format
        if (modelResult.data?.type === 'images' && modelResult.data.images) {
            const { apiClient } = await import('@/lib/apiClient');

            // Save images and return normalized gallery format
            const galleryImages = await Promise.all(
                modelResult.data.images.map(async (img: { url: string }, idx: number) => {
                    const imageId = `gen-${Date.now()}-${idx}`;

                    try {
                        let result;
                        if (img.url.startsWith('data:')) {
                            result = await apiClient.saveProcessedImage(img.url);
                        } else if (img.url.startsWith('http')) {
                            result = await apiClient.downloadAndSaveImage(img.url);
                        } else {
                            return { id: imageId, src: img.url, starred: false, caption: prompt.slice(0, 50) };
                        }
                        return { id: imageId, src: result.relativePath, starred: false, caption: prompt.slice(0, 50) };
                    } catch (err) {
                        console.error('Failed to save image:', err);
                        return { id: imageId, src: img.url, starred: false, caption: prompt.slice(0, 50) };
                    }
                })
            );

            return { success: true, data: galleryImages };
        }

        // Handle video output
        if (modelResult.data?.type === 'video' && modelResult.data.videoUrl) {
            return { success: true, data: { videoUrl: modelResult.data.videoUrl } };
        }

        return { success: true, data: modelResult.data };
    } catch (error: any) {
        return { success: false, error: error.message || 'Media generation failed' };
    }
}

// ============================================================================
// Registry for V2 Recipes
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
