import { useMemo, useEffect, useState } from 'react';
import type { ChatModelAdapter } from '@assistant-ui/react';
import { modelRegistry } from '@/features/models';
import { loadSettings } from '@/lib/settings';
import { useChatModelSelector } from './useChatModelSelector';
import { createBackendChatAdapter } from './BackendChatModelAdapter';

// Fallback adapter for error states
function createFallbackAdapter(message: string): ChatModelAdapter {
    return {
        async *run() {
            yield {
                content: [{
                    type: 'text' as const,
                    text: message,
                }],
            };
        },
    };
}

export function useChatModelAdapter(): ChatModelAdapter {
    const { selectedModelId } = useChatModelSelector();
    const [settings, setSettings] = useState<Awaited<ReturnType<typeof loadSettings>> | null>(null);

    // Load settings on mount
    useEffect(() => {
        loadSettings().then(setSettings);
    }, []);

    const adapter = useMemo<ChatModelAdapter>(() => {
        // 1. Get model from registry
        const model = modelRegistry.get(selectedModelId);
        if (!model) {
            console.warn(`[Chat] Model ${selectedModelId} not found`);
            return createFallbackAdapter(`⚠️ Model "${selectedModelId}" not found. Please select a different model.`);
        }

        // 2. Check if settings loaded
        if (!settings) {
            return createFallbackAdapter(`⏳ Loading settings...`);
        }

        // 3. Get provider
        const provider = model.provider || model.supportedProviders?.[0];
        if (!provider) {
            return createFallbackAdapter(`⚠️ Model "${model.name}" has no provider configured.`);
        }

        // 4. Use Backend ChatModelAdapter
        // This calls the Rust backend `chat_stream` command
        console.log(`[Chat] Using backend adapter for ${model.name} (${provider})`);
        return createBackendChatAdapter({
            modelId: selectedModelId,
            provider: provider,
        });

        // TODO: Legacy frontend adapter (commented out for Phase 8)
        // if (model.getChatAdapter) {
        //     const creds = getProviderCredentials(settings, provider as ProviderKey);
        //     if (!creds?.apiKey) {
        //         return createFallbackAdapter(
        //             `🔑 API key for ${provider} not configured.\n\nPlease add your API key in Settings → Models.`
        //         );
        //     }
        //     return model.getChatAdapter(creds, {
        //         temperature: 0.7,
        //         maxTokens: 4096,
        //     });
        // }

    }, [selectedModelId, settings]);

    return adapter;
}
