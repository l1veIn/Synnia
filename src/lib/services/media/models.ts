// Media Model Registry
// Maps recipes → models → providers

export type RecipeType =
    | 'text-to-image'
    | 'image-to-image'
    | 'text-to-video'
    | 'image-to-video'
    | 'start-end-frame'
    | 'reference-to-video';

export interface ModelDefinition {
    id: string;
    name: string;
    provider: 'openai' | 'fal' | 'replicate' | 'ppio' | 'modelscope' | 'kie';
    recipes: RecipeType[];  // Which recipes this model supports
    defaultParams?: Record<string, any>;
    // Model-specific options
    aspectRatios?: string[];
    resolutions?: string[];   // e.g., ['1k', '2k', '4k']
    durations?: number[];     // for video models
    maxImages?: number;
}

// Built-in model definitions
export const MODEL_REGISTRY: ModelDefinition[] = [
    // ======== Image Models ========
    {
        id: 'dall-e-3',
        name: 'DALL-E 3',
        provider: 'openai',
        recipes: ['text-to-image'],
        aspectRatios: ['1:1', '16:9', '9:16'],
        maxImages: 1,
    },
    {
        id: 'dall-e-2',
        name: 'DALL-E 2',
        provider: 'openai',
        recipes: ['text-to-image', 'image-to-image'],
        aspectRatios: ['1:1'],
        maxImages: 4,
    },
    {
        id: 'flux-schnell',
        name: 'Flux Schnell',
        provider: 'fal',
        recipes: ['text-to-image'],
        aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'],
        maxImages: 4,
    },
    {
        id: 'nano-banana',
        name: 'Nano Banana',
        provider: 'fal',
        recipes: ['text-to-image', 'image-to-image'],
        aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '3:2', '2:3'],
        maxImages: 4,
    },
    {
        id: 'nano-banana-pro',
        name: 'Nano Banana Pro',
        provider: 'fal',
        recipes: ['text-to-image', 'image-to-image'],
        aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '3:2', '2:3'],
        resolutions: ['1k', '2k', '4k'],  // Supports resolution selection
        maxImages: 4,
    },
    {
        id: 'seedream-4.0',
        name: 'Seedream 4.0',
        provider: 'fal',
        recipes: ['text-to-image', 'image-to-image'],
        aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
        maxImages: 4,
    },
    {
        id: 'z-image-turbo',
        name: 'Z-Image Turbo',
        provider: 'fal',
        recipes: ['text-to-image'],
        aspectRatios: ['1:1', '16:9', '9:16'],
        maxImages: 4,
    },

    // ======== Video Models ========
    {
        id: 'kling-v2.6',
        name: 'Kling V2.6 Pro',
        provider: 'fal',
        recipes: ['text-to-video', 'image-to-video'],
        aspectRatios: ['16:9', '9:16', '1:1'],
        durations: [5, 10],
    },
    {
        id: 'seedance-v1',
        name: 'Seedance V1',
        provider: 'fal',
        recipes: ['text-to-video', 'image-to-video'],
        aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
        durations: [5, 10],
    },
    {
        id: 'hailuo-2.3',
        name: 'Hailuo 2.3',
        provider: 'fal',
        recipes: ['text-to-video', 'image-to-video'],
        aspectRatios: ['16:9', '9:16', '1:1'],
        durations: [5],
    },
    {
        id: 'vidu-q2',
        name: 'Vidu Q2',
        provider: 'fal',
        recipes: ['text-to-video', 'image-to-video', 'reference-to-video'],
        aspectRatios: ['16:9', '9:16', '1:1'],
        durations: [2, 3, 4, 5, 6, 7, 8],
    },
    {
        id: 'sora-2',
        name: 'Sora 2',
        provider: 'fal',
        recipes: ['text-to-video', 'image-to-video'],
        aspectRatios: ['16:9', '9:16', '1:1'],
        durations: [5, 10, 15, 20],
    },
];

/**
 * Get models available for a specific recipe type
 */
export function getModelsForRecipe(recipeType: RecipeType): ModelDefinition[] {
    return MODEL_REGISTRY.filter(m => m.recipes.includes(recipeType));
}

/**
 * Get models available for a recipe type, filtered by configured providers
 */
export function getAvailableModels(
    recipeType: RecipeType,
    configuredProviders: string[]
): ModelDefinition[] {
    return MODEL_REGISTRY.filter(m =>
        m.recipes.includes(recipeType) &&
        configuredProviders.includes(m.provider)
    );
}

/**
 * Get model by ID
 */
export function getModelById(modelId: string): ModelDefinition | undefined {
    return MODEL_REGISTRY.find(m => m.id === modelId);
}

/**
 * Get all providers that support a given recipe type
 */
export function getProvidersForRecipe(recipeType: RecipeType): string[] {
    const models = getModelsForRecipe(recipeType);
    return [...new Set(models.map(m => m.provider))];
}
