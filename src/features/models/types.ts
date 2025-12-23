// Model Plugin System Types
// Unified architecture: All models are "Compute Units" (JSON-in -> JSON-out)

import { ReactNode } from 'react';

// ============================================================================
// Category & Capability Types
// ============================================================================

// Broad domain categories (NOT capability-based splits)
export type ModelCategory =
    | 'llm'                 // All language models (chat, vision, code)
    | 'image-generation'    // text/image -> image
    | 'video-generation';   // text/image -> video

// Fine-grained capabilities for filtering
export type ModelCapability =
    | 'chat'                // Basic text conversation
    | 'vision'              // Can process images
    | 'json-mode'           // Structured output
    | 'function-calling'    // Tool use
    | 'streaming';          // Stream responses

// ============================================================================
// Provider Types
// ============================================================================

export type ProviderType =
    | 'openai'
    | 'anthropic'
    | 'google'
    | 'deepseek'
    | 'fal'
    | 'replicate'
    | 'ppio'
    | 'ollama'
    | 'lmstudio'
    | 'comfyui';

export type ProviderKey = ProviderType;

export interface ProviderInfo {
    key: ProviderKey;
    name: string;
    description: string;
    type: 'cloud' | 'local';
    placeholder: string;           // For API key or base URL
    defaultBaseUrl?: string;       // Default base URL for local providers
    requiresApiKey: boolean;
}

export interface ProviderCredentials {
    apiKey?: string;
    baseUrl?: string;
}

// ============================================================================
// Unified Model Plugin Interface
// ============================================================================

export interface ModelConfigProps {
    value: any;
    onChange: (value: any) => void;
    disabled?: boolean;
    availableProviders: ProviderType[];
}

export interface HandleSpec {
    id: string;
    dataType: 'image' | 'video' | 'text' | 'any';
    label: string;
}

// Generic execution types (JSON-in, JSON-out)
export interface ModelExecutionInput {
    // Common fields
    prompt?: string;
    userPrompt?: string;        // Alias for prompt (LLM compatibility)
    systemPrompt?: string;
    negativePrompt?: string;
    images?: string[];          // For vision/img2img

    // Model-specific settings
    config?: Record<string, any>;

    // Auth (injected by engine)
    credentials: ProviderCredentials;

    // LLM-specific
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
}

export interface ModelExecutionResult {
    success: boolean;
    error?: string;

    // Output data (model determines structure)
    text?: string;              // LLM text output
    data?: any;                 // Parsed JSON or structured data
    images?: { url: string; width?: number; height?: number }[];
    videoUrl?: string;

    // Metadata
    wasTruncated?: boolean;
}

// The Unified Model Plugin
export interface ModelPlugin {
    // Identity
    id: string;
    name: string;
    description?: string;

    // Taxonomy
    category: ModelCategory;
    capabilities?: ModelCapability[];

    // Provider (for auth lookup)
    provider: ProviderType;
    supportedProviders?: ProviderType[];  // Legacy: for multi-provider models
    isLocal?: boolean;                    // Ollama, LM Studio

    // LLM-specific metadata (optional)
    contextWindow?: number;
    maxOutputTokens?: number;
    defaultTemperature?: number;

    // UI: Model renders its own config
    renderConfig: (props: ModelConfigProps) => ReactNode;

    // Dynamic IO: Declares input handles based on config
    getInputHandles?: (config: any) => HandleSpec[];

    // Validation
    validate?: (config: any) => { valid: boolean; errors?: string[] };

    // Execution: The Black Box
    execute: (input: ModelExecutionInput) => Promise<ModelExecutionResult>;
}

// ============================================================================
// Registry Interface
// ============================================================================

export interface ModelRegistry {
    models: Map<string, ModelPlugin>;
    register: (model: ModelPlugin) => void;
    get: (id: string) => ModelPlugin | undefined;
    getByCategory: (category: ModelCategory) => ModelPlugin[];
    getByCapabilities: (category: ModelCategory, caps: ModelCapability[]) => ModelPlugin[];
    getAll: () => ModelPlugin[];
}

// ============================================================================
// Legacy Aliases (for gradual migration)
// ============================================================================

// These will be removed in Phase 5
export type LLMPlugin = ModelPlugin;
export type LLMCapability = ModelCapability;
export type LLMExecutionInput = ModelExecutionInput;
export type LLMExecutionResult = ModelExecutionResult;

// Deprecated: Use ModelCategory instead
/** @deprecated Use 'llm' category with capabilities instead */
export type LegacyLLMCategory = 'llm-chat' | 'llm-vision' | 'llm-code';
