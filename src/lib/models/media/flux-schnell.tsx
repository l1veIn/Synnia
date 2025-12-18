// Flux Schnell Model Plugin
// Supports: text-to-image
// Providers: FAL

import { ModelPlugin, ModelConfigProps, ModelExecutionInput, ModelExecutionResult } from '../types';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

// ============================================================================
// Config Component
// ============================================================================

function FluxSchnellConfig({ value, onChange, disabled }: ModelConfigProps) {
    const config = value || { aspectRatio: '1:1', numImages: 1 };

    const handleChange = (key: string, val: any) => {
        onChange({ ...config, [key]: val });
    };

    const aspectRatios = ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'];

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

            {/* Number of Images */}
            <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                    Number of Images: {config.numImages}
                </Label>
                <Slider
                    value={[config.numImages]}
                    min={1}
                    max={4}
                    step={1}
                    onValueChange={(vals) => handleChange('numImages', vals[0])}
                    disabled={disabled}
                    className="py-1"
                />
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

        const result = await fal.subscribe('fal-ai/flux/schnell', {
            input: {
                prompt,
                image_size: config?.aspectRatio || '1:1',
                num_images: config?.numImages || 1,
            },
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
            error: error.message || 'Failed to generate image',
        };
    }
}

// ============================================================================
// Export Plugin
// ============================================================================

export const fluxSchnell: ModelPlugin = {
    id: 'flux-schnell',
    name: 'Flux Schnell',
    description: 'Ultra-fast image generation',
    category: 'text-to-image',
    supportedProviders: ['fal'],
    renderConfig: (props) => <FluxSchnellConfig {...props} />,
    execute,
};
