// Zhipu AI Image Generation Models
// Supports: glm-image, cogview-4, cogview-3-flash

import { ModelPlugin, ModelConfigProps, ModelExecutionInput, ModelExecutionResult } from '../types';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

// ============================================================================
// Types
// ============================================================================

interface ZhipuImageConfig {
    size: string;
    quality: 'hd' | 'standard';
    watermarkEnabled: boolean;
}

interface ZhipuImageResponse {
    created: number;
    data: Array<{ url: string }>;
    content_filter?: Array<{ role: string; level: number }>;
    error?: { code: string; message: string };
}

// Size presets per model
const GLM_IMAGE_SIZES = [
    '1280x1280',
    '1568x1056',
    '1056x1568',
    '1472x1088',
    '1088x1472',
    '1728x960',
    '960x1728',
];

const COGVIEW_SIZES = [
    '1024x1024',
    '768x1344',
    '864x1152',
    '1344x768',
    '1152x864',
    '1440x720',
    '720x1440',
];

// ============================================================================
// Config Component
// ============================================================================

function ZhipuImageConfig({ value, onChange, disabled }: ModelConfigProps) {
    const config: ZhipuImageConfig = {
        size: '1280x1280',
        quality: 'hd',
        watermarkEnabled: true,
        ...value
    };

    const handleChange = (key: string, val: any) => {
        onChange({ ...config, [key]: val });
    };

    // Use GLM sizes as default (most common)
    const sizes = GLM_IMAGE_SIZES;

    return (
        <div className="space-y-3 p-3 rounded-lg border border-border/50 bg-muted/20">
            {/* Size */}
            <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Image Size</Label>
                <Select
                    value={config.size}
                    onValueChange={(v) => handleChange('size', v)}
                    disabled={disabled}
                >
                    <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {sizes.map((size) => (
                            <SelectItem key={size} value={size} className="text-xs">
                                {size}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Quality */}
            <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Quality</Label>
                <div className="flex gap-2">
                    <Button
                        variant={config.quality === 'hd' ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 px-3 text-xs flex-1"
                        onClick={() => handleChange('quality', 'hd')}
                        disabled={disabled}
                    >
                        HD (~20s)
                    </Button>
                    <Button
                        variant={config.quality === 'standard' ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 px-3 text-xs flex-1"
                        onClick={() => handleChange('quality', 'standard')}
                        disabled={disabled}
                    >
                        Standard (~5-10s)
                    </Button>
                </div>
            </div>

            {/* Watermark */}
            <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">
                    AI Watermark
                    <span className="ml-1 text-[10px] text-muted-foreground/60">(required by policy)</span>
                </Label>
                <Switch
                    checked={config.watermarkEnabled}
                    onCheckedChange={(v) => handleChange('watermarkEnabled', v)}
                    disabled={disabled}
                />
            </div>
        </div>
    );
}

// ============================================================================
// Execution
// ============================================================================

const ZHIPU_IMAGE_URL = 'https://open.bigmodel.cn/api/paas/v4/images/generations';

async function executeZhipuImage(
    input: ModelExecutionInput,
    modelId: string
): Promise<ModelExecutionResult> {
    const { config, prompt, credentials } = input;

    if (!credentials.apiKey) {
        return { success: false, error: 'Zhipu API key not configured' };
    }

    if (!prompt) {
        return { success: false, error: 'Prompt is required for image generation' };
    }

    try {
        const requestBody: any = {
            model: modelId,
            prompt: prompt,
        };

        // Add optional parameters
        if (config?.size) {
            requestBody.size = config.size;
        }
        if (config?.quality) {
            requestBody.quality = config.quality;
        }
        if (config?.watermarkEnabled !== undefined) {
            requestBody.watermark_enabled = config.watermarkEnabled;
        }

        const response = await fetch(credentials.baseUrl || ZHIPU_IMAGE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${credentials.apiKey}`,
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Zhipu Image] HTTP Error:', response.status, errorText);
            return { success: false, error: `Zhipu Image API error: ${response.status} - ${errorText}` };
        }

        const data: ZhipuImageResponse = await response.json();

        if (data.error) {
            return { success: false, error: `${data.error.code}: ${data.error.message}` };
        }

        if (!data.data || data.data.length === 0) {
            return { success: false, error: 'No image generated' };
        }

        // Check content filter warnings
        const criticalFilter = data.content_filter?.find(f => f.level <= 1);
        if (criticalFilter) {
            console.warn('[Zhipu Image] Content filter triggered:', criticalFilter);
        }

        // Parse size for width/height
        const [width, height] = (config?.size || '1280x1280').split('x').map(Number);

        return {
            success: true,
            images: data.data.map(img => ({
                url: img.url,
                width: width || 1280,
                height: height || 1280,
            })),
        };
    } catch (error: any) {
        console.error('[Zhipu Image] Call failed:', error);
        return { success: false, error: error.message || 'Zhipu Image API call failed' };
    }
}

// ============================================================================
// Model Factory
// ============================================================================

interface ZhipuImageModelConfig {
    id: string;
    name: string;
    description: string;
    defaultSize: string;
    defaultQuality: 'hd' | 'standard';
    sizes: string[];
}

function createZhipuImageModel(config: ZhipuImageModelConfig): ModelPlugin {
    return {
        id: config.id,
        name: config.name,
        description: config.description,
        category: 'image-generation',
        provider: 'zhipu',
        supportedProviders: ['zhipu'],
        capabilities: [],

        renderConfig: (props) => <ZhipuImageConfig {...props} />,

        execute: (input) => executeZhipuImage(input as ModelExecutionInput, config.id),
    };
}

// ============================================================================
// Model Exports
// ============================================================================

// GLM-Image: Latest flagship image model (HD quality, ~20s)
export const glmImage = createZhipuImageModel({
    id: 'glm-image',
    name: 'GLM-Image',
    description: 'Zhipu flagship image generation with HD quality',
    defaultSize: '1280x1280',
    defaultQuality: 'hd',
    sizes: GLM_IMAGE_SIZES,
});

// CogView-4: Previous generation (supports standard quality)
export const cogview4 = createZhipuImageModel({
    id: 'cogview-4',
    name: 'CogView-4',
    description: 'High quality image generation',
    defaultSize: '1024x1024',
    defaultQuality: 'standard',
    sizes: COGVIEW_SIZES,
});

// CogView-3-Flash: Fast generation
export const cogview3Flash = createZhipuImageModel({
    id: 'cogview-3-flash',
    name: 'CogView-3 Flash',
    description: 'Fast image generation for quick iterations',
    defaultSize: '1024x1024',
    defaultQuality: 'standard',
    sizes: COGVIEW_SIZES,
});
