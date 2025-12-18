// Nano Banana Pro Model Plugin
// Supports: text-to-image
// Providers: FAL

import { ModelPlugin, ModelConfigProps, ModelExecutionInput, ModelExecutionResult } from '../types';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

// ============================================================================
// Config Component
// ============================================================================

function NanoBananaProConfig({ value, onChange, disabled }: ModelConfigProps) {
    const config = value || { resolution: '2k', aspectRatio: '1:1' };

    const handleChange = (key: string, val: string) => {
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
        // Dynamic import like existing image.ts
        const { fal } = await import('@fal-ai/client');

        fal.config({ credentials: credentials.apiKey });

        const result = await fal.subscribe('fal-ai/nano-banana', {
            input: {
                prompt,
                image_size: config?.aspectRatio || '1:1',
            } as any,
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

export const nanoBananaPro: ModelPlugin = {
    id: 'nano-banana-pro',
    name: 'Nano Banana Pro',
    description: 'Fast, high-quality image generation with resolution control',
    category: 'text-to-image',
    supportedProviders: ['fal'],
    renderConfig: (props) => <NanoBananaProConfig {...props} />,
    execute,
};
