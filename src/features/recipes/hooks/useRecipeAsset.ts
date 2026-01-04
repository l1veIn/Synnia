/**
 * useRecipeAsset - Hook to access and modify Recipe asset configuration
 * Provides easy access to deep config properties (modelConfig, chatContext)
 */

import { useCallback, useMemo } from 'react';
import { useAsset } from '@/hooks/useAsset';
import type { RecordAsset, RecordAssetConfig, FieldDefinition } from '@/types/assets';
import type { ModelConfig, ChatContext, ChatMessage, RecipeExtra } from '@/features/recipes/types';

export interface UseRecipeAssetResult {
    // The raw asset
    asset: RecordAsset | null;

    // Convenience accessors for config
    recipeId: string | undefined;
    schema: FieldDefinition[] | undefined;
    modelConfig: ModelConfig | undefined;
    chatContext: ChatContext | undefined;
    messages: ChatMessage[];

    // Updaters
    updateModelConfig: (config: ModelConfig) => void;
    updateChatContext: (context: ChatContext) => void;
    addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
    clearMessages: () => void;
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

    // Chat Context updater
    const updateChatContext = useCallback((chatContext: ChatContext) => {
        if (!assetId || !recordAsset) return;

        updateConfig({
            ...recordAsset.config,
            extra: {
                ...(recordAsset.config?.extra as RecipeExtra),
                chatContext,
            },
        });
    }, [assetId, recordAsset, updateConfig]);

    // Add a message to chatContext
    const addMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
        if (!assetId || !recordAsset) return;

        const currentContext = extra?.chatContext ?? { messages: [] };
        const newMessage: ChatMessage = {
            ...message,
            id: crypto.randomUUID(),
            timestamp: Date.now(),
        };

        updateConfig({
            ...recordAsset.config,
            extra: {
                ...(recordAsset.config?.extra as RecipeExtra),
                chatContext: {
                    messages: [...currentContext.messages, newMessage],
                },
            },
        });
    }, [assetId, recordAsset, extra, updateConfig]);

    // Clear all messages
    const clearMessages = useCallback(() => {
        if (!assetId || !recordAsset) return;

        updateConfig({
            ...recordAsset.config,
            extra: {
                ...(recordAsset.config?.extra as RecipeExtra),
                chatContext: { messages: [] },
            },
        });
    }, [assetId, recordAsset, updateConfig]);

    return {
        asset: recordAsset ?? null,
        recipeId: extra?.recipeId,
        schema,
        modelConfig: extra?.modelConfig,
        chatContext: extra?.chatContext,
        messages: extra?.chatContext?.messages ?? [],
        updateModelConfig,
        updateChatContext,
        addMessage,
        clearMessages,
    };
}
