// Agent Executor
// Unified executor for all AI model calls (LLM, Image Gen, Video Gen)
// Migrated from ModelExecutor to follow the Executor interface pattern

import { ExecutionContext, ExecutionResult, RecipeManifest } from '@/domain/recipe/manifest';
import { modelRegistry } from '@/infrastructure/models';
import { ModelExecutionInput, ModelExecutionResult, ProviderKey } from '@/infrastructure/models/types';
import { getSettings, getProviderCredentials } from '@/lib/settings';
import { interpolate } from '@/application/recipe/promptUtils';
import { extractJson } from '@/infrastructure/models/utils';
import { apiClient } from '@/lib/apiClient';
import { Executor } from '../types';

type Credentials = { apiKey?: string; baseUrl?: string } | null;

// ============================================================================
// Backend LLM Execution (unified for all LLM providers)
// ============================================================================

async function executeBackendLLM(
    provider: ProviderKey,
    modelId: string,
    input: ModelExecutionInput
): Promise<ModelExecutionResult> {
    const { systemPrompt, jsonMode } = input;
    const userPrompt = input.userPrompt || input.prompt || '';

    try {
        console.log(`[AgentExecutor]: Calling backend execute_model_command for ${provider}/${modelId}`);
        const { invoke } = await import('@tauri-apps/api/core');

        const result = await invoke<{
            success: boolean;
            error?: string;
            text?: string;
        }>('execute_model_command', {
            request: {
                provider: provider,
                modelId: modelId,
                prompt: userPrompt,
                systemPrompt: systemPrompt,
            }
        });

        if (!result.success) {
            return { success: false, error: result.error || 'Backend execution failed' };
        }

        const responseText = result.text || '';

        if (jsonMode) {
            const { data, success } = extractJson(responseText);
            if (success) {
                return { success: true, text: responseText, data };
            } else {
                return { success: false, text: responseText, error: 'Failed to parse JSON' };
            }
        }

        return { success: true, text: responseText };
    } catch (error: any) {
        console.error(`[AgentExecutor] Backend call failed for ${provider}:`, error);
        return { success: false, error: error.message || `${provider} backend call failed` };
    }
}

// ============================================================================
// Agent Executor (Single Entry Point for Model-based Recipes)
// ============================================================================

export const AgentExecutor: Executor = {
    type: 'agent',

    canHandle(manifest: RecipeManifest): boolean {
        // Handle agent-type recipes or default to agent if no type specified
        const executorType = manifest.executor?.type;
        return executorType === 'agent' || executorType === undefined;
    },

    async execute(ctx: ExecutionContext): Promise<ExecutionResult> {
        const { modelConfig, manifest } = ctx;

        // 1. Validate model selection
        const modelId = modelConfig?.modelId;
        if (!modelId) {
            return { success: false, error: 'No model selected' };
        }

        // 2. Get model plugin
        const modelPlugin = modelRegistry.get(modelId);
        if (!modelPlugin) {
            return { success: false, error: `Model not found: ${modelId}` };
        }

        // 3. Get credentials
        const settings = getSettings();
        const provider = (modelConfig?.provider || modelPlugin.provider) as import('@/lib/settings/types').ProviderKey;
        const credentials = getProviderCredentials(settings, provider);

        if (!credentials?.apiKey && !credentials?.baseUrl && !modelPlugin.isLocal) {
            return { success: false, error: `No credentials configured for ${provider}` };
        }

        // 4. Determine input mode by category
        const isMedia = modelPlugin.category === 'image-generation' || modelPlugin.category === 'video-generation';

        try {
            // 5. Prepare input
            const input = isMedia
                ? prepareMediaInput(ctx, credentials, provider, manifest)
                : prepareLLMInput(ctx, credentials, manifest);

            // 6. Execute model
            let result: ModelExecutionResult;

            if (modelPlugin.execute) {
                // Custom executor (image/video gen models)
                result = await modelPlugin.execute(input);
            } else {
                // Default: use backend execute_model_command (LLMs)
                result = await executeBackendLLM(provider, modelId, input);
            }

            if (!result.success) {
                return { success: false, error: result.error };
            }

            // 7. Process output (dispatch by result type, not category)
            return await processOutput(result, manifest, ctx.inputs.prompt || '');

        } catch (error: any) {
            return { success: false, error: error.message || 'Execution failed' };
        }
    }
};

// ============================================================================
// Input Preparation
// ============================================================================

function prepareLLMInput(
    ctx: ExecutionContext,
    credentials: Credentials,
    manifest?: RecipeManifest
): ModelExecutionInput {
    const { inputs, modelConfig, chatContext, asset } = ctx;

    // Get executor config (type-guard for agent executor)
    const executor = manifest?.executor;
    const agentConfig = executor?.type === 'agent' ? executor : undefined;

    // Get prompts from asset (copied from manifest at node creation time)
    const promptSource = (asset?.config as any)?.extra?.prompt;

    // Build prompts from templates
    const systemPrompt = promptSource?.system
        ? interpolate(promptSource.system, inputs)
        : '';

    let userPrompt: string;
    if (chatContext && chatContext.length > 0) {
        const lastUserMsg = [...chatContext].reverse().find(m => m.role === 'user');
        userPrompt = lastUserMsg?.content || interpolate(promptSource?.user || '', inputs);
    } else {
        userPrompt = interpolate(promptSource?.user || '', inputs);
    }

    const isTextOutput = manifest?.output?.node === 'text';

    return {
        systemPrompt,
        userPrompt,
        temperature: modelConfig?.params?.temperature ?? agentConfig?.model?.defaultParams?.temperature ?? 0.7,
        maxTokens: modelConfig?.params?.maxTokens ?? agentConfig?.model?.defaultParams?.maxTokens ?? 2048,
        jsonMode: !isTextOutput && (modelConfig?.params?.jsonMode !== false),
        credentials: {
            apiKey: credentials?.apiKey || '',
            baseUrl: credentials?.baseUrl,
        },
    };
}

function prepareMediaInput(
    ctx: ExecutionContext,
    credentials: Credentials,
    provider: string,
    manifest?: RecipeManifest
): ModelExecutionInput {
    const { inputs, modelConfig, asset } = ctx;

    // Get executor config (type-guard for agent executor)
    const executor = manifest?.executor;
    const agentConfig = executor?.type === 'agent' ? executor : undefined;

    // Get prompts from asset (copied from manifest at node creation time)
    const promptSource = (asset?.config as any)?.extra?.prompt;

    // Build prompt: use template interpolation if available, otherwise direct input
    const finalPrompt = promptSource?.user
        ? interpolate(promptSource.user, inputs)
        : inputs.prompt || '';

    // Get images from multiple possible sources:
    // 1. model:visionImage (from DynamicInputPorts - now gallery dataType)
    // 2. inputs.image (legacy/direct single image)
    const visionInput = inputs['model:visionImage'];
    const directImage = inputs.image;

    // Build images array for model input
    let images: any[] | undefined;

    if (visionInput) {
        // From vision port - could be:
        // - Gallery data: array of items with { src, id, ... }
        // - PortValue wrapper: { value: [...], type: 'gallery' }
        // - Single image object
        const galleryData = typeof visionInput === 'object' && visionInput.value
            ? visionInput.value  // Unwrap PortValue
            : visionInput;

        if (Array.isArray(galleryData)) {
            // Gallery format: extract src from each item
            images = galleryData.map(item => {
                if (typeof item === 'string') return item;
                return item.src || item.url || item.value || item;
            }).filter(Boolean);
        } else if (typeof galleryData === 'string') {
            images = [galleryData];
        } else if (galleryData?.src || galleryData?.url) {
            images = [galleryData.src || galleryData.url];
        }
    } else if (directImage) {
        images = [directImage];
    }

    const config = { ...modelConfig?.params };

    return {
        provider: provider as any,  // Provider for multi-provider models
        config,
        prompt: finalPrompt,
        negativePrompt: inputs.negativePrompt,
        images,
        credentials: {
            apiKey: credentials?.apiKey || '',
            baseUrl: credentials?.baseUrl,
        },
    };
}

// ============================================================================
// Output Processing (unified, dispatch by result type)
// ============================================================================

async function processOutput(
    result: ModelExecutionResult,
    manifest?: RecipeManifest,
    prompt?: string
): Promise<ExecutionResult> {
    // 1. Image output (top-level result.images)
    if (result.images && result.images.length > 0) {
        const galleryImages = await Promise.all(
            result.images.map(async (img, idx) => {
                const imageId = `gen-${Date.now()}-${idx}`;
                const caption = (prompt || '').slice(0, 50);
                try {
                    // Use unified importResource for both data: URLs and http: URLs
                    if (img.url.startsWith('data:') || img.url.startsWith('http')) {
                        const saveResult = await apiClient.importResource(img.url);
                        // Use assetId for GalleryNode reference pattern
                        return {
                            id: imageId,
                            mediaAssetId: saveResult.assetId,
                            starred: false,
                            caption
                        };
                    } else {
                        // Local path - no asset created, fallback to legacy format
                        return { id: imageId, src: img.url, starred: false, caption };
                    }
                } catch (err) {
                    console.error('Failed to save image:', err);
                    // Fallback to URL on error
                    return { id: imageId, src: img.url, starred: false, caption };
                }
            })
        );
        return { success: true, data: galleryImages };
    }

    // 2. Video output (top-level result.videoUrl)
    if (result.videoUrl) {
        return { success: true, data: { videoUrl: result.videoUrl } };
    }

    // 3. Text/JSON output (LLM)
    const isTextOutput = manifest?.output?.node === 'text';

    if (!isTextOutput && result.text) {
        const parsed = extractJson(result.text);
        if (!parsed.success) {
            return { success: false, error: 'Failed to parse JSON response' };
        }
        return { success: true, data: parsed.data };
    }

    return { success: true, data: result.data ?? result.text ?? '' };
}
