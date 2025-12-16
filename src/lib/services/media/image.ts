// Image Generation Service
// Uses Vercel AI SDK experimental_generateImage + custom providers

import { experimental_generateImage as generateImage } from 'ai';
import { openai } from '@ai-sdk/openai';
import {
    GenerateImageParams,
    ImageResult,
    GeneratedImage,
    MediaProvider
} from './types';
import { getDefaultImageProvider, getMediaProvider } from './config';

/**
 * Generate images using configured provider
 */
export async function generateImages(params: GenerateImageParams): Promise<ImageResult> {
    const provider = params.providerId
        ? await getMediaProvider(params.providerId)
        : await getDefaultImageProvider();

    if (!provider) {
        return { success: false, error: 'No image provider configured' };
    }

    try {
        switch (provider.type) {
            case 'openai':
                return await generateWithOpenAI(params, provider);
            case 'fal':
                return await generateWithFal(params, provider);
            default:
                return { success: false, error: `Unsupported provider type: ${provider.type}` };
        }
    } catch (error: any) {
        console.error('[ImageGen] Error:', error);
        return { success: false, error: error.message || 'Image generation failed' };
    }
}

/**
 * Generate images using OpenAI (DALL-E) via Vercel AI SDK
 */
async function generateWithOpenAI(
    params: GenerateImageParams,
    provider: MediaProvider
): Promise<ImageResult> {
    // Determine model
    const model = params.model || 'dall-e-3';

    // Parse size
    let size: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792' = '1024x1024';
    if (params.size) {
        // Handle aspect ratio format
        if (params.size.includes(':')) {
            const [w, h] = params.size.split(':').map(Number);
            if (w > h) size = '1792x1024';
            else if (h > w) size = '1024x1792';
            else size = '1024x1024';
        } else if (['256x256', '512x512', '1024x1024', '1792x1024', '1024x1792'].includes(params.size)) {
            size = params.size as any;
        }
    }

    params.onProgress?.({ status: 'PROCESSING', progress: 10, message: 'Starting generation...' });

    const result = await generateImage({
        model: openai.image(model),
        prompt: params.prompt,
        size,
        n: params.n || 1,
    });

    params.onProgress?.({ status: 'COMPLETED', progress: 100, message: 'Done' });

    // Convert to our format
    const images: GeneratedImage[] = result.images.map(img => ({
        url: img.base64 ? `data:image/png;base64,${img.base64}` : '',
        base64: img.base64,
    }));

    return { success: true, images };
}

/**
 * Generate images using Fal.ai
 * Requires @fal-ai/client to be installed
 */
async function generateWithFal(
    params: GenerateImageParams,
    provider: MediaProvider
): Promise<ImageResult> {
    try {
        // Dynamic import to avoid bundling if not used
        const { fal } = await import('@fal-ai/client');

        // Configure client
        if (provider.apiKey) {
            fal.config({ credentials: provider.apiKey });
        }

        // Default model
        const model = params.model || 'fal-ai/fast-sdxl';

        params.onProgress?.({ status: 'QUEUED', progress: 5, message: 'Submitting request...' });

        // Use subscribe for automatic polling
        const result = await fal.subscribe(model, {
            input: {
                prompt: params.prompt,
                negative_prompt: params.negativePrompt,
                image_size: params.size || 'landscape_16_9',
                num_images: params.n || 1,
                seed: params.seed,
            },
            logs: true,
            onQueueUpdate: (update: any) => {
                if (params.onProgress) {
                    const status = update.status === 'IN_QUEUE' ? 'QUEUED'
                        : update.status === 'IN_PROGRESS' ? 'PROCESSING'
                            : 'COMPLETED';
                    params.onProgress({
                        status: status as any,
                        queuePosition: update.queue_position,
                        message: update.status === 'IN_QUEUE'
                            ? `Queue position: ${update.queue_position}`
                            : 'Generating...',
                        progress: update.status === 'IN_QUEUE' ? 10
                            : update.status === 'IN_PROGRESS' ? 50
                                : 100,
                    });
                }
            },
        });

        params.onProgress?.({ status: 'COMPLETED', progress: 100, message: 'Done' });

        // Parse result
        const images: GeneratedImage[] = (result.data?.images || []).map((img: any) => ({
            url: img.url,
            width: img.width,
            height: img.height,
        }));

        return { success: true, images };
    } catch (error: any) {
        console.error('[Fal] Error:', error);
        return { success: false, error: error.message || 'Fal generation failed' };
    }
}
