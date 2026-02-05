// Google Gemini LLM Plugins
// Model definitions only - execution handled by AgentExecutor

import { ModelPlugin, HandleSpec } from '../types';
import { DefaultLLMSettings } from '../shared/DefaultLLMSettings';

// ============================================================================
// Factory Function for Gemini Models
// ============================================================================

interface GeminiModelConfig {
    id: string;
    name: string;
    description: string;
    hasVision: boolean;
    contextWindow: number;
    maxOutputTokens: number;
}

const createGeminiModel = (config: GeminiModelConfig): ModelPlugin => ({
    id: config.id,
    name: config.name,
    description: config.description,
    category: 'llm',
    supportedProviders: ['google'],
    provider: 'google',
    capabilities: config.hasVision
        ? ['chat', 'vision', 'function-calling', 'json-mode', 'streaming']
        : ['chat', 'function-calling', 'json-mode', 'streaming'],
    contextWindow: config.contextWindow,
    maxOutputTokens: config.maxOutputTokens,
    defaultTemperature: 0.7,

    renderConfig: (props) => (
        <DefaultLLMSettings
            {...props}
            defaultTemperature={0.7}
            maxOutputTokens={config.maxOutputTokens}
        />
    ),

    getInputHandles: config.hasVision
        ? (cfg) => {
            if (!cfg?.visionImage) {
                return [{ id: 'visionImage', dataType: 'image', label: 'Vision Image' } as HandleSpec];
            }
            return [];
        }
        : undefined,
    // No execute - AgentExecutor uses backend execute_model_command
});

// ============================================================================
// Gemini Model Exports
// ============================================================================

export const gemini25Flash = createGeminiModel({
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Latest Gemini with 1M context',
    hasVision: true,
    contextWindow: 1000000,
    maxOutputTokens: 65536,
});

export const gemini2Flash = createGeminiModel({
    id: 'gemini-2.0-flash-exp',
    name: 'Gemini 2.0 Flash',
    description: 'Fast Gemini model with multimodal support',
    hasVision: true,
    contextWindow: 1000000,
    maxOutputTokens: 8192,
});

export const gemini3Pro = createGeminiModel({
    id: 'gemini-3-pro-preview',
    name: 'Gemini 3.0 Pro',
    description: 'Latest Gemini 3 Pro preview with improved tool calling',
    hasVision: true,
    contextWindow: 2000000,
    maxOutputTokens: 65536,
});

export const gemini3Flash = createGeminiModel({
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3.0 Flash',
    description: 'Fast Gemini 3 Flash preview with improved tool calling',
    hasVision: true,
    contextWindow: 1000000,
    maxOutputTokens: 32768,
});
