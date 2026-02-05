// Gemini Image Model Plugin
// Supports: text-to-image, image-to-image (with reference)
// Provider: Google (Gemini 3 Pro Image Preview)

import { ModelPlugin, ModelConfigProps, ModelExecutionInput, ModelExecutionResult } from '../types';
import { Label } from '@/presentation/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/presentation/components/ui/select';
import { Button } from '@/presentation/components/ui/button';

// ============================================================================
// Config Component
// ============================================================================

interface GeminiImageConfig {
    resolution: string;
    aspectRatio: string;
    useGoogleSearch?: boolean;
}

function GeminiImageConfig({ value, onChange, disabled }: ModelConfigProps) {
    const config: GeminiImageConfig = {
        resolution: '2k',
        aspectRatio: '1:1',
        useGoogleSearch: false,
        ...value
    };

    const handleChange = (key: string, val: any) => {
        onChange({ ...config, [key]: val });
    };

    const resolutions = ['1k', '2k', '4k'];
    const aspectRatios = ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '3:2', '2:3'];

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

            {/* Google Search Toggle */}
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
        </div>
    );
}

// ============================================================================
// Execution
// ============================================================================

async function execute(input: ModelExecutionInput): Promise<ModelExecutionResult> {
    const { config, prompt, credentials } = input;

    if (!prompt) {
        return { success: false, error: 'Prompt is required' };
    }

    if (!credentials.apiKey) {
        return { success: false, error: 'Google API key not configured' };
    }

    try {
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

        // Add reference images from input.images array
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

        // Extract image from response
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
        console.error('[Gemini Image] Generation error:', error);
        return {
            success: false,
            error: error.message || 'Google: Failed to generate image',
        };
    }
}

// ============================================================================
// Export Plugin
// ============================================================================

export const geminiImage: ModelPlugin = {
    id: 'gemini-image',
    name: 'Gemini Image',
    description: 'Gemini 3 Pro image generation with Google Search',
    category: 'image-generation',
    capabilities: ['vision'],
    provider: 'google',
    renderConfig: (props) => <GeminiImageConfig {...props} />,
    execute: execute as any,
};
