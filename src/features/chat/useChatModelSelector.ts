import { useState, useEffect, useMemo } from 'react';
import { modelRegistry } from '@/features/models';

const STORAGE_KEY = 'synnia-chat-model';
const DEFAULT_MODEL = 'gemini-2.5-flash';

export function useChatModelSelector() {
    const [selectedModelId, setSelectedModelId] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem(STORAGE_KEY) || DEFAULT_MODEL;
        }
        return DEFAULT_MODEL;
    });

    // Persist to localStorage
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, selectedModelId);
    }, [selectedModelId]);

    // Get available chat models (only those with getChatAdapter)
    const availableModels = useMemo(() => {
        return modelRegistry
            .getAll()
            .filter(m => m.getChatAdapter && m.capabilities?.includes('chat'));
    }, []);

    return {
        selectedModelId,
        setSelectedModelId,
        availableModels,
    };
}
