// Zhipu AI (智谱 AI) LLM Plugins
// Model definitions only - execution handled by AgentExecutor via backend ZhipuClient

import { ModelPlugin, HandleSpec } from '../types';
import { DefaultLLMSettings } from '../shared/DefaultLLMSettings';

// ============================================================================
// Factory Function for Zhipu Models
// ============================================================================

interface ZhipuModelConfig {
    id: string;
    name: string;
    description: string;
    hasVision: boolean;
    contextWindow: number;
    maxOutputTokens: number;
}

const createZhipuModel = (config: ZhipuModelConfig): ModelPlugin => ({
    id: config.id,
    name: config.name,
    description: config.description,
    category: 'llm',
    supportedProviders: ['zhipu'],
    provider: 'zhipu',
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
    // No execute - AgentExecutor uses backend ZhipuClient via execute_model_command
});

// ============================================================================
// Zhipu Model Exports
// ============================================================================

// GLM-4.7: Latest flagship model (200K context, 128K output)
export const glm47 = createZhipuModel({
    id: 'glm-4.7',
    name: 'GLM-4.7',
    description: 'Zhipu flagship model with reasoning capabilities',
    hasVision: false,
    contextWindow: 200000,
    maxOutputTokens: 96000,
});

// GLM-4.6v: Vision model (based on GLM-4.6, 200K context, 128K output)
export const glm46v = createZhipuModel({
    id: 'glm-4.6v',
    name: 'GLM-4.6v',
    description: 'Zhipu multimodal model with vision support',
    hasVision: true,
    contextWindow: 200000,
    maxOutputTokens: 96000,
});

// GLM-4-Flash: Fast and affordable (128K context, 16K output)
export const glm4Flash = createZhipuModel({
    id: 'glm-4-flash',
    name: 'GLM-4-Flash',
    description: 'Fast and cost-effective GLM model',
    hasVision: false,
    contextWindow: 128000,
    maxOutputTokens: 16000,
});

// GLM-4.7-Flash: Free model (200K context, 128K output)
export const glm47Flash = createZhipuModel({
    id: 'glm-4.7-flash',
    name: 'GLM-4.7-Flash',
    description: 'Free flagship model with full capabilities',
    hasVision: false,
    contextWindow: 200000,
    maxOutputTokens: 96000,
});

