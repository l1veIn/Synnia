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
                ? prepareMediaInput(ctx, credentials)
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
    const { inputs, modelConfig, chatContext } = ctx;

    // Build prompts from manifest templates
    const systemPrompt = manifest?.prompt?.system
        ? interpolate(manifest.prompt.system, inputs)
        : '';

    let userPrompt: string;
    if (chatContext && chatContext.length > 0) {
        const lastUserMsg = [...chatContext].reverse().find(m => m.role === 'user');
        userPrompt = lastUserMsg?.content || interpolate(manifest?.prompt?.user || '', inputs);
    } else {
        userPrompt = interpolate(manifest?.prompt?.user || '', inputs);
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

function prepareMediaInput(ctx: ExecutionContext, credentials: Credentials): ModelExecutionInput {
    const { inputs, modelConfig } = ctx;

    return {
        config: modelConfig?.params,
        prompt: inputs.prompt || '',
        negativePrompt: inputs.negativePrompt,
        images: inputs.image ? [inputs.image] : undefined,
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
                try {
                    let saveResult;
                    if (img.url.startsWith('data:')) {
                        saveResult = await apiClient.saveProcessedImage(img.url);
                    } else if (img.url.startsWith('http')) {
                        saveResult = await apiClient.downloadAndSaveImage(img.url);
                    } else {
                        return { id: imageId, src: img.url, starred: false, caption: (prompt || '').slice(0, 50) };
                    }
                    return { id: imageId, src: saveResult.relativePath, starred: false, caption: (prompt || '').slice(0, 50) };
                } catch (err) {
                    console.error('Failed to save image:', err);
                    return { id: imageId, src: img.url, starred: false, caption: (prompt || '').slice(0, 50) };
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

