// ============================================================================
// Media Executor
// Uses Model Plugin System for image/video generation
// Node creation is handled by useRunRecipe using executor.output config
// ============================================================================

import {
    ExecutionContext,
    ExecutionResult,
    RecipeExecutor,
    ExecutorConfig,
} from '@/types/recipe';
import { extractValue, extractText } from '../utils';

// Executor-specific configuration
export interface MediaExecutorConfig extends ExecutorConfig {
    type: 'media';
    mode: 'image-generation' | 'video-generation';
    // Note: output config is read from manifest by useRunRecipe
}

export const createExecutor = (config: MediaExecutorConfig): RecipeExecutor => {
    return async (ctx: ExecutionContext): Promise<ExecutionResult> => {
        const { inputs } = ctx;

        try {
            // Extract modelConfig from inputs
            const modelConfigValue = extractValue(inputs.modelConfig);
            if (!modelConfigValue?.modelId) {
                return { success: false, error: 'No model selected' };
            }

            // Get the model plugin
            const { getModel } = await import('@/lib/models');
            const modelPlugin = getModel(modelConfigValue.modelId);
            if (!modelPlugin) {
                return { success: false, error: `Model not found: ${modelConfigValue.modelId}` };
            }

            // Get credentials from settings
            const { getSettings, getProviderCredentials } = await import('@/lib/settings');
            const settings = getSettings();
            const provider = (modelConfigValue.provider || modelPlugin.provider || (modelPlugin.supportedProviders || [])[0]) as import('@/lib/settings/types').ProviderKey;
            const credentials = getProviderCredentials(settings, provider);

            if (!credentials?.apiKey && !credentials?.baseUrl) {
                return { success: false, error: `No credentials configured for ${provider}` };
            }

            // Execute via model plugin
            const prompt = extractText(inputs.prompt);
            const negativePrompt = inputs.negativePrompt ? extractText(inputs.negativePrompt) : undefined;
            const images = inputs.image ? [extractValue(inputs.image)] : undefined;

            const modelResult = await modelPlugin.execute({
                config: modelConfigValue.config,
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

                // Return gallery-ready data - node creation handled by execution engine
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
    };
};
