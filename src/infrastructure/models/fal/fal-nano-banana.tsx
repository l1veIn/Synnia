// FAL Nano Banana Model Plugin
// Supports: text-to-image, image-to-image (with reference)
// Provider: FAL

import { ModelPlugin, ModelConfigProps, ModelExecutionInput, ModelExecutionResult } from '../types';
import { Label } from '@/presentation/components/ui/label';
import { Button } from '@/presentation/components/ui/button';

// ============================================================================
// Config Component
// ============================================================================

function FalNanoBananaConfig({ value, onChange, disabled }: ModelConfigProps) {
    const config = {
        aspectRatio: '1:1',
        ...value
    };

    const handleChange = (key: string, val: any) => {
        onChange({ ...config, [key]: val });
    };

    const aspectRatios = ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '3:2', '2:3'];

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
// Export Plugin
// ============================================================================

export const falNanoBanana: ModelPlugin = {
    id: 'fal-nano-banana',
    name: 'Nano Banana',
    description: 'Fast image generation with reference image support',
    category: 'image-generation',
    capabilities: ['vision'],
    provider: 'fal',
    renderConfig: (props) => <FalNanoBananaConfig {...props} />,
    execute: execute as any,
};
