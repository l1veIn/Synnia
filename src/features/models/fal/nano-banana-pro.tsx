// Nano Banana Pro Model Plugin
// Supports: text-to-image, image-to-image (with reference)
// Providers: FAL, Google (Gemini)

import { ModelPlugin, ModelConfigProps, ModelExecutionInput, ModelExecutionResult, ProviderType } from '../types';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

// ============================================================================
// Config Component
// ============================================================================

interface NanoBananaConfig {
    resolution: string;
    aspectRatio: string;
    useGoogleSearch?: boolean;
}

function NanoBananaProConfig({ value, onChange, disabled, provider }: ModelConfigProps) {
    const config: NanoBananaConfig = {
        resolution: '2k',
        aspectRatio: '1:1',
        useGoogleSearch: false,
        ...value  // Merge with existing values
    };

    const handleChange = (key: string, val: any) => {
        onChange({ ...config, [key]: val });
    };

    const resolutions = ['1k', '2k', '4k'];
    const aspectRatios = ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '3:2', '2:3'];

    // Check if current provider is Gemini-based (supports Google Search)
    const isGeminiProvider = provider === 'google' || provider === 'g4f';

    return (
        <div className="space-y-3 p-3 rounded-lg border border-border/50 bg-muted/20">
            {/* Resolution */}
            <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Resolution</Label>
                <Select
                    value={config.resolution}
                    onValueChange={(v) => handleChange('resolution', v)}
                    disabled={disabled}
                >
                    <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {resolutions.map((res) => (
                            <SelectItem key={res} value={res} className="text-xs">
                                {res.toUpperCase()}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Aspect Ratio */}
            <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Aspect Ratio</Label>
                <div className="flex flex-wrap gap-1.5">
                    {aspectRatios.map((ar) => (
                        <Button
                            key={ar}
                            variant={config.aspectRatio === ar ? 'default' : 'outline'}
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleChange('aspectRatio', ar)}
                            disabled={disabled}
                        >
                            {ar}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Google Search Toggle (Gemini only) */}
            {isGeminiProvider && (
                <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">
                        Use Google Search
                        <span className="ml-1 text-[10px] text-muted-foreground/60">(for real-time info)</span>
                    </Label>
                    <Button
                        variant={config.useGoogleSearch ? 'default' : 'outline'}
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => handleChange('useGoogleSearch', !config.useGoogleSearch)}
                        disabled={disabled}
                    >
                        {config.useGoogleSearch ? 'ON' : 'OFF'}
                    </Button>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// Execution - FAL Provider
// ============================================================================

async function executeFal(input: ModelExecutionInput): Promise<ModelExecutionResult> {
    const { config, prompt, credentials } = input;

    try {
        const { fal } = await import('@fal-ai/client');
        fal.config({ credentials: credentials.apiKey });

        // Build input
        const falInput: any = {
            prompt,
            image_size: config?.aspectRatio || '1:1',
        };

        // Add reference image if provided
        if (config?.referenceImage?.url || config?.referenceImage?.base64) {
            const imageUrl = config.referenceImage.url ||
                `data:${config.referenceImage.mimeType || 'image/png'};base64,${config.referenceImage.base64}`;
            falInput.image_url = imageUrl;
        }

        const result = await fal.subscribe('fal-ai/nano-banana', {
            input: falInput,
        });

        const images = ((result.data as any)?.images || []).map((img: any) => ({
            url: img.url,
            width: img.width,
            height: img.height,
        }));

        return {
            success: true,
            images,
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message || 'FAL: Failed to generate image',
        };
    }
}

// ============================================================================
// Execution - Google Gemini Provider
// ============================================================================

async function executeGoogle(input: ModelExecutionInput): Promise<ModelExecutionResult> {
    const { config, prompt, credentials } = input;

    try {
        // Dynamic import
        const { GoogleGenAI } = await import('@google/genai');

        const clientOptions: any = { apiKey: credentials.apiKey };
        if (credentials.baseUrl) {
            clientOptions.baseUrl = credentials.baseUrl;
        }

        const client = new GoogleGenAI(clientOptions);

        // Build content parts
        const parts: any[] = [];
        let finalPrompt = prompt || '';

        // Helper function to extract base64 from image URL/data
        const extractBase64 = (imgData: any): { base64: string; mimeType: string } | null => {
            if (typeof imgData === 'string') {
                if (imgData.startsWith('data:')) {
                    return {
                        base64: imgData.split(',')[1],
                        mimeType: imgData.split(';')[0].split(':')[1]
                    };
                }
                // External URL - not supported yet
                return null;
            }
            if (imgData?.base64) {
                return { base64: imgData.base64, mimeType: imgData.mimeType || 'image/png' };
            }
            if (imgData?.url?.startsWith('data:')) {
                return {
                    base64: imgData.url.split(',')[1],
                    mimeType: imgData.url.split(';')[0].split(':')[1]
                };
            }
            if (imgData?.src?.startsWith('data:')) {
                return {
                    base64: imgData.src.split(',')[1],
                    mimeType: imgData.src.split(';')[0].split(':')[1]
                };
            }
            return null;
        };

        // Add reference images from input.images array (multi-image support)
        const inputImages = (input as any).images;
        if (inputImages && Array.isArray(inputImages)) {
            for (const img of inputImages) {
                const imgData = extractBase64(img);
                if (imgData) {
                    parts.push({
                        inlineData: { data: imgData.base64, mimeType: imgData.mimeType }
                    });
                }
            }
            if (parts.length > 0) {
                finalPrompt = `(Strictly follow the character design in the reference image(s)) ${prompt || ''}`;
            }
        }
        // Fallback: single reference image from config
        else if (config?.referenceImage?.base64 || config?.referenceImage?.url) {
            const imgData = extractBase64(config.referenceImage);
            if (imgData) {
                parts.push({
                    inlineData: { data: imgData.base64, mimeType: imgData.mimeType }
                });
                finalPrompt = `(Strictly follow the character design in the reference image) ${prompt || ''}`;
            }
        }

        parts.push({ text: finalPrompt });

        // Build config
        const generateConfig: any = {
            imageConfig: {
                aspectRatio: config?.aspectRatio || '1:1',
                imageSize: config?.resolution?.toUpperCase() || '2K',
            }
        };

        // Add Google Search tool if enabled
        if (config?.useGoogleSearch) {
            generateConfig.tools = [{ google_search: {} }];
        }

        // Call Gemini Imagen
        const response = await client.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: { parts },
            config: generateConfig
        });


        // Extract image from response - check multiple possible locations
        const candidates = (response as any).candidates || [];
        for (const candidate of candidates) {
            const parts = candidate?.content?.parts || [];
            for (const part of parts) {
                if (part.inlineData?.data) {
                    return {
                        success: true,
                        images: [{
                            url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                            width: 1024,
                            height: 1024,
                        }]
                    };
                }
            }
        }

        // Check if there's text explaining why no image was generated
        const textParts = candidates[0]?.content?.parts?.filter((p: any) => p.text) || [];
        if (textParts.length > 0) {
            const textResponse = textParts.map((p: any) => p.text).join('\n');
            return { success: false, error: `Gemini declined to generate: ${textResponse.slice(0, 200)}` };
        }

        return { success: false, error: 'No image data found in Gemini response' };
    } catch (error: any) {
        console.error('[Gemini] Image generation error:', error);
        return {
            success: false,
            error: error.message || 'Google: Failed to generate image',
        };
    }
}

// ============================================================================
// Execution - g4f Local Provider (OpenAI-compatible)
// ============================================================================

async function executeG4F(input: ModelExecutionInput): Promise<ModelExecutionResult> {
    const { config, prompt, credentials } = input;

    if (!credentials.baseUrl) {
        return { success: false, error: 'g4f: No base URL configured. Please set the g4f URL in Settings > Models.' };
    }

    const baseUrl = credentials.baseUrl;

    try {
        // g4f returns images via chat completion endpoint
        // The image URL is returned in the 'reasoning' field of the response
        const messages: any[] = [];

        // Add reference image if provided
        if (config?.referenceImage?.url || config?.referenceImage?.base64) {
            const imageUrl = config.referenceImage.url ||
                `data:${config.referenceImage.mimeType || 'image/png'};base64,${config.referenceImage.base64}`;
            messages.push({
                role: 'user',
                content: [
                    { type: 'image_url', image_url: { url: imageUrl } },
                    { type: 'text', text: `Generate an image based on this reference: ${prompt}` }
                ]
            });
        } else {
            messages.push({
                role: 'user',
                content: `Generate an image: ${prompt}`
            });
        }

        const response = await fetch(`${baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'Gemini',
                messages,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            return {
                success: false,
                error: `g4f: ${response.status} - ${errorText}`,
            };
        }

        const data = await response.json();

        // Check for error in response
        if (data.error) {
            return {
                success: false,
                error: `g4f: ${data.error.message || JSON.stringify(data.error)}`,
            };
        }

        // g4f returns image URL in the 'reasoning' field
        // Format: "https://lh3.googleusercontent.com/...\n\n$signature...\n\nimage/png\n\n..."
        const reasoning = data.choices?.[0]?.message?.reasoning;
        let imageUrl: string | null = null;

        if (reasoning) {
            // Extract the first URL from the reasoning field
            const urlMatch = reasoning.match(/https:\/\/lh3\.googleusercontent\.com\/[^\s\n]+/);
            if (urlMatch) {
                imageUrl = urlMatch[0];
            }
        }

        // Fallback: check if there's text content that might contain an image
        if (!imageUrl) {
            const content = data.choices?.[0]?.message?.content;
            if (content && content.includes('http')) {
                const urlMatch = content.match(/(https?:\/\/[^\s]+\.(png|jpg|jpeg|webp|gif))/i);
                if (urlMatch) {
                    imageUrl = urlMatch[0];
                }
            }
        }

        if (!imageUrl) {
            return {
                success: false,
                error: 'g4f: No image URL found in response',
            };
        }

        // Use Tauri command to fetch image (bypasses CORS)
        // Browser fetch fails due to CORS, Tauri has no such restriction
        try {
            const { apiClient } = await import('@/lib/apiClient');
            const result = await apiClient.fetchImageAsBase64(imageUrl);

            if (result.success && result.data) {
                return {
                    success: true,
                    images: [{ url: result.data, width: 1024, height: 1024 }],
                };
            } else {
                console.error('[g4f] Tauri fetch failed:', result.error);
                // Return URL as fallback (will likely fail but worth trying)
                return {
                    success: true,
                    images: [{ url: imageUrl, width: 1024, height: 1024 }],
                };
            }
        } catch (fetchError) {
            console.error('[g4f] Failed to fetch image via Tauri:', fetchError);
            // Return URL as fallback
            return {
                success: true,
                images: [{ url: imageUrl, width: 1024, height: 1024 }],
            };
        }
    } catch (error: any) {
        console.error('[g4f] Image generation error:', error);
        return {
            success: false,
            error: error.message || 'g4f: Failed to generate image',
        };
    }
}

// ============================================================================
// Main Execute Function
// ============================================================================

async function execute(input: ModelExecutionInput): Promise<ModelExecutionResult> {
    const { prompt } = input;

    if (!prompt) {
        return { success: false, error: 'Prompt is required' };
    }

    // Use input.provider (passed from ModelExecutor via modelConfig.provider)
    // Fallback to config.provider for backwards compatibility, then to 'fal'
    const provider = input.provider || input.config?.provider || 'fal';

    switch (provider) {
        case 'google':
            return executeGoogle(input);
        case 'g4f':
            return executeG4F(input);
        case 'fal':
        default:
            return executeFal(input);
    }
}

// ============================================================================
// Export Plugin
// ============================================================================

export const nanoBananaPro: ModelPlugin = {
    id: 'nano-banana-pro',
    name: 'Nano Banana Pro',
    description: 'Fast image generation with reference image support (FAL / Google Gemini)',
    category: 'image-generation',
    capabilities: ['vision'],  // Supports image-to-image with reference
    provider: 'fal',  // Primary provider
    supportedProviders: ['fal', 'google', 'g4f'],
    renderConfig: (props) => <NanoBananaProConfig {...props} />,
    execute: execute as any,
};
