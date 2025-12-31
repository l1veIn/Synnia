/**
 * useRecipeAsset - Hook to access and modify Recipe asset configuration
 * Provides easy access to deep config properties (modelConfig, chatContext)
 */

import { useCallback, useMemo } from 'react';
import { useAsset } from '@/hooks/useAsset';
import type {
    RecordAsset,
    RecipeAssetConfig,
    ModelConfig,
    ChatContext,
    ChatMessage
} from '@/types/assets';

export interface UseRecipeAssetResult {
    // The raw asset
    asset: RecordAsset | null;

    // Convenience accessors for config
    recipeId: string | undefined;
    schema: RecipeAssetConfig['schema'] | undefined;
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

    // Type-safe config access
    const config = useMemo(() => {
        if (!recordAsset || recordAsset.valueType !== 'record') return undefined;
        return recordAsset.config as RecipeAssetConfig | undefined;
    }, [recordAsset]);

    // Model Config updater
    const updateModelConfig = useCallback((modelConfig: ModelConfig) => {
        if (!assetId || !recordAsset) return;

        updateConfig({
            ...recordAsset.config,
            modelConfig,
        });
    }, [assetId, recordAsset, updateConfig]);

    // Chat Context updater
    const updateChatContext = useCallback((chatContext: ChatContext) => {
        if (!assetId || !recordAsset) return;

        updateConfig({
            ...recordAsset.config,
            chatContext,
        });
    }, [assetId, recordAsset, updateConfig]);

    // Add a new message to chat context
    const addMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
        if (!assetId || !recordAsset) return;

        const currentContext = (recordAsset.config as RecipeAssetConfig)?.chatContext ?? { messages: [] };
        const newMessage: ChatMessage = {
            ...message,
            id: crypto.randomUUID(),
            timestamp: Date.now(),
        };

        updateConfig({
            ...recordAsset.config,
            chatContext: {
                messages: [...currentContext.messages, newMessage],
            },
        });
    }, [assetId, recordAsset, updateConfig]);

    // Clear all messages
    const clearMessages = useCallback(() => {
        if (!assetId || !recordAsset) return;

        updateConfig({
            ...recordAsset.config,
            chatContext: { messages: [] },
        });
    }, [assetId, recordAsset, updateConfig]);

    return {
        asset: recordAsset ?? null,
        recipeId: config?.recipeId,
        schema: config?.schema,
        modelConfig: config?.modelConfig,
        chatContext: config?.chatContext,
        messages: config?.chatContext?.messages ?? [],
        updateModelConfig,
        updateChatContext,
        addMessage,
        clearMessages,
    };
}
