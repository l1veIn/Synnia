// Model Executor
// Unified executor for all AI model calls (LLM, Image Gen, Video Gen)

import { ExecutionContext, ExecutionResult, RecipeManifest } from '@/types/recipe';
import { modelRegistry } from '@features/models';
import { ModelPlugin, ModelExecutionInput, ModelExecutionResult } from '@features/models/types';
import { getSettings, getProviderCredentials } from '@/lib/settings';
import { interpolate } from '../promptUtils';
import { extractJson } from '@features/models/utils';
import { apiClient } from '@/lib/apiClient';

type Credentials = { apiKey?: string; baseUrl?: string } | null;

// ============================================================================
// Model Executor (Single Entry Point)
// ============================================================================

export const ModelExecutor = {
    type: 'model',

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
                ? prepareMediaInput(ctx, credentials, provider)
                : prepareLLMInput(ctx, credentials, manifest);

            // 6. Execute model
            const result = await modelPlugin.execute(input);

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

    // Get prompts: prioritize user-customized prompts from asset, fallback to manifest defaults
    const assetPrompt = (asset?.config as any)?.extra?.prompt;
    const promptSource = assetPrompt || manifest?.prompt;

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
        temperature: modelConfig?.params?.temperature ?? manifest?.model?.defaultParams?.temperature ?? 0.7,
        maxTokens: modelConfig?.params?.maxTokens ?? manifest?.model?.defaultParams?.maxTokens ?? 2048,
        jsonMode: !isTextOutput && (modelConfig?.params?.jsonMode !== false),
        credentials: {
            apiKey: credentials?.apiKey || '',
            baseUrl: credentials?.baseUrl,
        },
    };
}

function prepareMediaInput(ctx: ExecutionContext, credentials: Credentials, provider: string): ModelExecutionInput {
    const { inputs, modelConfig } = ctx;

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
        prompt: inputs.prompt || '',
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
                    let saveResult;
                    if (img.url.startsWith('data:')) {
                        saveResult = await apiClient.saveProcessedImage(img.url);
                    } else if (img.url.startsWith('http')) {
                        saveResult = await apiClient.downloadAndSaveImage(img.url);
                    } else {
                        // Local path - no asset created, fallback to legacy format
                        return { id: imageId, src: img.url, starred: false, caption };
                    }
                    // Use assetId for GalleryNode reference pattern
                    return {
                        id: imageId,
                        mediaAssetId: saveResult.assetId,
                        starred: false,
                        caption
                    };
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

