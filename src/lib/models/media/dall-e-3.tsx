// DALL-E 3 Model Plugin
// Supports: text-to-image
// Providers: OpenAI

import { experimental_generateImage as generateImage } from 'ai';
import { openai } from '@ai-sdk/openai';
import { ModelPlugin, ModelConfigProps, ModelExecutionInput, ModelExecutionResult } from '../types';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

// ============================================================================
// Config Component
// ============================================================================

function DallE3Config({ value, onChange, disabled }: ModelConfigProps) {
    const config = value || { size: '1024x1024', style: 'vivid', quality: 'standard' };

    const handleChange = (key: string, val: string) => {
        onChange({ ...config, [key]: val });
    };

    const sizes = [
        { value: '1024x1024', label: '1:1 (1024×1024)' },
        { value: '1792x1024', label: '16:9 (1792×1024)' },
        { value: '1024x1792', label: '9:16 (1024×1792)' },
    ];

    const styles = [
        { value: 'vivid', label: 'Vivid' },
        { value: 'natural', label: 'Natural' },
    ];

    const qualities = [
        { value: 'standard', label: 'Standard' },
        { value: 'hd', label: 'HD' },
    ];

    return (
        <div className="space-y-3 p-3 rounded-lg border border-border/50 bg-muted/20">
            {/* Size */}
            <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Size</Label>
                <Select
                    value={config.size}
                    onValueChange={(v) => handleChange('size', v)}
                    disabled={disabled}
                >
                    <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {sizes.map((s) => (
                            <SelectItem key={s.value} value={s.value} className="text-xs">
                                {s.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Style */}
            <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Style</Label>
                <div className="flex gap-1.5">
                    {styles.map((s) => (
                        <Button
                            key={s.value}
                            variant={config.style === s.value ? 'default' : 'outline'}
                            size="sm"
                            className="h-7 px-3 text-xs flex-1"
                            onClick={() => handleChange('style', s.value)}
                            disabled={disabled}
                        >
                            {s.label}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Quality */}
            <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Quality</Label>
                <div className="flex gap-1.5">
                    {qualities.map((q) => (
                        <Button
                            key={q.value}
                            variant={config.quality === q.value ? 'default' : 'outline'}
                            size="sm"
                            className="h-7 px-3 text-xs flex-1"
                            onClick={() => handleChange('quality', q.value)}
                            disabled={disabled}
                        >
                            {q.label}
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
        // Set API key via environment variable for Vercel AI SDK
        // Note: In production, this should be handled via server-side
        process.env.OPENAI_API_KEY = credentials.apiKey;

        const result = await generateImage({
            model: openai.image('dall-e-3'),
            prompt,
            size: (config?.size || '1024x1024') as any,
            n: 1,  // DALL-E 3 only supports 1
        });

        const images = result.images.map((img) => ({
            url: img.base64 ? `data:image/png;base64,${img.base64}` : '',
            width: parseInt(config?.size?.split('x')[0] || '1024'),
            height: parseInt(config?.size?.split('x')[1] || '1024'),
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

export const dallE3: ModelPlugin = {
    id: 'dall-e-3',
    name: 'DALL-E 3',
    description: 'OpenAI\'s most advanced image generation model',
    category: 'image-generation',
    supportedProviders: ['openai'],
    renderConfig: (props) => <DallE3Config {...props} />,
    execute: execute as any,
};
