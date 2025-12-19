// Nano Banana Pro Model Plugin
// Supports: text-to-image, image-to-image (with reference)
// Providers: FAL, Google (Gemini)

import { ModelPlugin, ModelConfigProps, ModelExecutionInput, ModelExecutionResult, ProviderType } from '../types';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ImagePicker } from '@/components/workflow/inspector/widgets/ImagePicker';
import { ImagePickerValue } from '@/lib/utils/image';

// ============================================================================
// Config Component
// ============================================================================

interface NanoBananaConfig {
    resolution: string;
    aspectRatio: string;
    provider: ProviderType;
    referenceImage?: ImagePickerValue;
}

function NanoBananaProConfig({ value, onChange, disabled }: ModelConfigProps) {
    const config: NanoBananaConfig = value || {
        resolution: '2k',
        aspectRatio: '1:1',
        provider: 'fal'
    };

    const handleChange = (key: string, val: any) => {
        onChange({ ...config, [key]: val });
    };

    const resolutions = ['1k', '2k', '4k'];
    const aspectRatios = ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '3:2', '2:3'];
    const providers: { id: ProviderType; label: string }[] = [
        { id: 'fal', label: 'FAL (Nano Banana)' },
        { id: 'google', label: 'Google (Gemini Imagen)' },
    ];

    return (
        <div className="space-y-3 p-3 rounded-lg border border-border/50 bg-muted/20">
            {/* Provider Selection */}
            <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Provider</Label>
                <Select
                    value={config.provider}
                    onValueChange={(v) => handleChange('provider', v)}
                    disabled={disabled}
                >
                    <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {providers.map((p) => (
                            <SelectItem key={p.id} value={p.id} className="text-xs">
                                {p.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Resolution (FAL only) */}
            {config.provider === 'fal' && (
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
            )}

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

            {/* Reference Image (Image-to-Image) */}
            <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                    Reference Image <span className="text-muted-foreground/60">(optional)</span>
                </Label>
                <ImagePicker
                    value={config.referenceImage}
                    onChange={(v) => handleChange('referenceImage', v)}
                    disabled={disabled}
                />
            </div>
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
            data: { type: 'images', images },
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
        let finalPrompt = prompt;

        // Add reference image if provided (Image-to-Image)
        if (config?.referenceImage?.base64 || config?.referenceImage?.url) {
            let base64Data: string;
            let mimeType: string;

            if (config.referenceImage.base64) {
                base64Data = config.referenceImage.base64;
                mimeType = config.referenceImage.mimeType || 'image/png';
            } else {
                // If it's a data URL, extract base64
                const url = config.referenceImage.url!;
                if (url.startsWith('data:')) {
                    base64Data = url.split(',')[1];
                    mimeType = url.split(';')[0].split(':')[1];
                } else {
                    // For external URLs, Gemini might not support directly
                    // TODO: Fetch and convert to base64 if needed
                    return { success: false, error: 'External URLs not yet supported for reference images' };
                }
            }

            parts.push({
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType
                }
            });
            finalPrompt = `(Strictly follow the character design in the reference image) ${prompt}`;
        }

        parts.push({ text: finalPrompt });

        // Call Gemini Imagen
        const response = await client.models.generateContent({
            model: 'gemini-2.0-flash-preview-image-generation',
            contents: { parts },
            config: {
                responseModalities: ['Text', 'Image'],
                imageConfig: {
                    aspectRatio: config?.aspectRatio || '1:1',
                }
            } as any
        });

        // Extract image from response
        for (const part of (response as any).candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return {
                    success: true,
                    data: {
                        type: 'images',
                        images: [{
                            url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                            width: 1024,
                            height: 1024,
                        }]
                    }
                };
            }
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
// Main Execute Function
// ============================================================================

async function execute(input: ModelExecutionInput): Promise<ModelExecutionResult> {
    const { config, prompt } = input;

    if (!prompt) {
        return { success: false, error: 'Prompt is required' };
    }

    const provider = config?.provider || 'fal';

    switch (provider) {
        case 'google':
            return executeGoogle(input);
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
    category: 'text-to-image',
    supportedProviders: ['fal', 'google'],
    renderConfig: (props) => <NanoBananaProConfig {...props} />,
    execute,
};
