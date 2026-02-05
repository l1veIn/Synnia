// g4f Gemini Image Model Plugin
// Supports: text-to-image via g4f local proxy
// Provider: g4f (local)

import { ModelPlugin, ModelConfigProps, ModelExecutionInput, ModelExecutionResult } from '../types';
import { Label } from '@/presentation/components/ui/label';
import { Button } from '@/presentation/components/ui/button';

// ============================================================================
// Config Component
// ============================================================================

function G4fGeminiImageConfig({ value, onChange, disabled }: ModelConfigProps) {
    const config = {
        aspectRatio: '1:1',
        ...value
    };

    const handleChange = (key: string, val: any) => {
        onChange({ ...config, [key]: val });
    };

    const aspectRatios = ['1:1', '16:9', '9:16', '4:3', '3:4'];

    return (
        <div className="space-y-3 p-3 rounded-lg border border-border/50 bg-muted/20">
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

            {/* Info about g4f */}
            <div className="text-[10px] text-muted-foreground/70 bg-muted/30 p-2 rounded">
                Requires g4f server running locally. Uses Gemini via proxy.
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

    if (!credentials.baseUrl) {
        return { success: false, error: 'g4f: No base URL configured. Please set the g4f URL in Settings > Models.' };
    }

    const baseUrl = credentials.baseUrl;

    try {
        // g4f returns images via chat completion endpoint
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
        const reasoning = data.choices?.[0]?.message?.reasoning;
        let imageUrl: string | null = null;

        if (reasoning) {
            const urlMatch = reasoning.match(/https:\/\/lh3\.googleusercontent\.com\/[^\s\n]+/);
            if (urlMatch) {
                imageUrl = urlMatch[0];
            }
        }

        // Fallback: check content
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
                return {
                    success: true,
                    images: [{ url: imageUrl, width: 1024, height: 1024 }],
                };
            }
        } catch (fetchError) {
            console.error('[g4f] Failed to fetch image via Tauri:', fetchError);
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
// Export Plugin
// ============================================================================

export const g4fGeminiImage: ModelPlugin = {
    id: 'g4f-gemini-image',
    name: 'Gemini Image (g4f)',
    description: 'Free Gemini image generation via g4f proxy',
    category: 'image-generation',
    capabilities: ['vision'],
    provider: 'g4f',
    isLocal: true,
    renderConfig: (props) => <G4fGeminiImageConfig {...props} />,
    execute: execute as any,
};
