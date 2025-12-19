// Model Plugin System Types
// Each model is a self-contained plugin with its own form, validation, and execution logic

import { ReactNode } from 'react';

// ============================================================================
// Category Types
// ============================================================================

export type ModelCategory =
    // Media categories (simplified)
    | 'image-generation'    // text/image → image
    | 'video-generation'    // text/image → video
    // LLM categories
    | 'llm-chat'
    | 'llm-vision'
    | 'llm-code';

// ============================================================================
// Provider Types
// ============================================================================

export type ProviderType =
    | 'fal'
    | 'openai'
    | 'anthropic'
    | 'google'
    | 'deepseek'
    | 'replicate'
    | 'ppio'
    | 'ollama'
    | 'lmstudio';

export interface ProviderCredentials {
    apiKey?: string;
    baseUrl?: string;  // For custom endpoints or local providers
}

// ============================================================================
// Model Plugin Interface
// ============================================================================

export interface ModelConfigProps {
    value: any;
    onChange: (value: any) => void;
    disabled?: boolean;
    availableProviders: ProviderType[];  // Providers user has configured
}

// Media Execution Types
export interface ModelExecutionInput {
    config: any;              // Model-specific config from renderConfig
    prompt?: string;
    negativePrompt?: string;
    images?: string[];        // Input images (URLs or base64)
    credentials: ProviderCredentials;
}

export interface ModelExecutionResult {
    success: boolean;
    data?: {
        type: 'images' | 'video' | 'text';
        images?: { url: string; width?: number; height?: number }[];
        videoUrl?: string;
        text?: string;
    };
    error?: string;
}

// LLM Execution Types
export interface LLMExecutionInput {
    systemPrompt?: string;
    userPrompt: string;
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
    credentials: ProviderCredentials;
    // Multimodal support
    images?: string[];  // URLs or base64 encoded images
}

export interface LLMExecutionResult {
    success: boolean;
    text?: string;
    data?: any;  // Parsed JSON if jsonMode
    error?: string;
    wasTruncated?: boolean;
}

// ============================================================================
// Unified Model Plugin Interface
// ============================================================================

export type LLMCapability =
    | 'chat'
    | 'vision'
    | 'function-calling'
    | 'json-mode'
    | 'streaming';

export interface ModelPlugin {
    // Metadata
    id: string;
    name: string;
    description?: string;
    category: ModelCategory;

    // Provider support
    supportedProviders: ProviderType[];
    provider?: ProviderType;  // Primary provider (for LLMs)
    isLocal?: boolean;        // True for Ollama/LM Studio

    // LLM-specific metadata (optional)
    capabilities?: LLMCapability[];
    contextWindow?: number;
    maxOutputTokens?: number;
    defaultTemperature?: number;

    // UI: Model renders its own config form
    renderConfig: (props: ModelConfigProps) => ReactNode;

    // Input handles: Model declares what external inputs it needs
    getInputHandles?: (config: any) => HandleSpec[];

    // Validation (optional)
    validate?: (config: any) => { valid: boolean; errors?: string[] };

    // Execution: Model handles its own API calls
    // For Media models: uses ModelExecutionInput -> ModelExecutionResult
    // For LLM models: uses LLMExecutionInput -> LLMExecutionResult
    execute: (input: ModelExecutionInput | LLMExecutionInput) => Promise<ModelExecutionResult | LLMExecutionResult>;
}

// Handle specification for widget-declared inputs
export interface HandleSpec {
    id: string;
    dataType: 'image' | 'video' | 'text' | 'any';
    label: string;
}

// ============================================================================
// Registry Types
// ============================================================================

export interface ModelRegistry {
    models: Map<string, ModelPlugin>;
    register: (model: ModelPlugin) => void;
    get: (id: string) => ModelPlugin | undefined;
    getByCategory: (category: ModelCategory) => ModelPlugin[];
    getAll: () => ModelPlugin[];
}

// Legacy alias for backward compatibility
export type LLMPlugin = ModelPlugin;

