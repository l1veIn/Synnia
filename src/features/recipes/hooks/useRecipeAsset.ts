/**
 * useRecipeAsset - Hook to access and modify Recipe asset configuration
 * Provides easy access to deep config properties (modelConfig)
 * 
 * TEP #001: chatContext moved to useChatContext hook (operational layer)
 */

import { useCallback, useMemo } from 'react';
import { useAsset } from '@/hooks/useAsset';
import type { RecordAsset, FieldDefinition } from '@/types/assets';
import type { ModelConfig, RecipeExtra } from '@/features/recipes/types';

export interface UseRecipeAssetResult {
    // The raw asset
    asset: RecordAsset | null;

    // Convenience accessors for config
    recipeId: string | undefined;
    schema: FieldDefinition[] | undefined;
    modelConfig: ModelConfig | undefined;

    // Updaters
    updateModelConfig: (config: ModelConfig) => void;
}

/**
 * Hook to access Recipe-specific asset properties with type safety
 */
export function useRecipeAsset(assetId: string | undefined): UseRecipeAssetResult {
    const { asset, updateConfig } = useAsset(assetId);
    const recordAsset = asset as RecordAsset | undefined;

    // Type-safe access to extra as RecipeExtra
    const extra = useMemo(() => {
        if (!recordAsset || recordAsset.valueType !== 'record') return undefined;
        return (recordAsset.config?.extra as RecipeExtra) ?? undefined;
    }, [recordAsset]);

    const schema = recordAsset?.config?.schema;

    // Model Config updater
    const updateModelConfig = useCallback((modelConfig: ModelConfig) => {
        if (!assetId || !recordAsset) return;

        updateConfig({
            ...recordAsset.config,
            extra: {
                ...(recordAsset.config?.extra as RecipeExtra),
                modelConfig,
            },
        });
    }, [assetId, recordAsset, updateConfig]);

    return {
        asset: recordAsset ?? null,
        recipeId: extra?.recipeId,
        schema,
        modelConfig: extra?.modelConfig,
        updateModelConfig,
    };
}
