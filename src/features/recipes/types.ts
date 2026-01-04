/**
 * Recipe-specific Types
 *
 * These types are extensions specific to RecipeNode and should not
 * pollute the core Asset type system.
 */

import type { RecordAssetConfig } from '@/types/assets';

// ==========================================
// AI Model Configuration
// ==========================================

/**
 * AI Model Configuration
 * Stores the selected model and its parameters for a Recipe
 */
export interface ModelConfig {
    modelId: string;       // e.g., 'gpt-4-turbo'
    provider?: string;     // e.g., 'openai'
    params?: Record<string, any>; // e.g., { temperature: 0.7 }
}

// ==========================================
// Chat / Multi-turn Conversation
// ==========================================

/**
 * Reference to another asset (for multi-modal or RAG)
 */
export interface AssetReference {
    assetId: string;
    type: 'image' | 'text' | 'file';
}

/**
 * Chat Message Structure for multi-turn conversations
 */
export interface ChatMessage {
    id: string;
    role: 'system' | 'user' | 'assistant';
    content: string;
    timestamp: number;
    attachments?: AssetReference[];
    outputAssetId?: string;
}

/**
 * Chat Context - stores conversation history for a Recipe
 */
export interface ChatContext {
    messages: ChatMessage[];
}

// ==========================================
// Recipe Extra Configuration
// ==========================================

/**
 * Recipe-specific extensions stored in asset.config.extra
 * Provides strong typing for Recipe nodes
 */
export interface RecipeExtra {
    recipeId?: string;
    modelConfig?: ModelConfig;
    chatContext?: ChatContext;
}

/**
 * Recipe Asset Configuration
 * Extends base RecordAssetConfig with Recipe-specific extra typing
 */
export interface RecipeAssetConfig extends RecordAssetConfig {
    extra?: RecipeExtra;
}

// ==========================================
// Utility Type Guards
// ==========================================

export function hasRecipeExtra(config: RecordAssetConfig | undefined): config is RecipeAssetConfig {
    if (!config?.extra) return false;
    const extra = config.extra as RecipeExtra;
    return 'recipeId' in extra || 'modelConfig' in extra || 'chatContext' in extra;
}
