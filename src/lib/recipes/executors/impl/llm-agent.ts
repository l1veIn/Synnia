// ============================================================================
// LLM Agent Executor
// Calls LLM with templated prompts
// Node creation is handled by GraphMutator.buildNodesFromConfig
// ============================================================================

import {
    ExecutionContext,
    ExecutionResult,
    RecipeExecutor,
    ExecutorConfig,
} from '@/types/recipe';
import { interpolate } from '../utils';

// Executor-specific configuration
export interface LlmAgentExecutorConfig extends ExecutorConfig {
    type: 'llm-agent';
    systemPrompt?: string;
    userPromptTemplate: string;
    parseAs?: 'json' | 'text';
    temperature?: number;
    maxTokens?: number;
    // Note: createNodes and nodeConfig are read from manifest by the execution engine,
    // not processed here. The executor only returns data.
}

export const createExecutor = (config: LlmAgentExecutorConfig): RecipeExecutor => {
    return async (ctx: ExecutionContext): Promise<ExecutionResult> => {
        const { inputs } = ctx;

        try {
            // Build prompts from template
            const systemPrompt = config.systemPrompt
                ? interpolate(config.systemPrompt, inputs)
                : '';
            const userPrompt = interpolate(config.userPromptTemplate, inputs);

            if (!userPrompt.trim()) {
                return { success: false, error: 'User prompt is empty' };
            }

            // Use LLM Plugin system for LLM call
            const { callLLM } = await import('@/lib/models/llm');
            const response = await callLLM({
                systemPrompt: systemPrompt || undefined,
                userPrompt,
                temperature: config.temperature ?? inputs.temperature ?? 0.7,
                maxTokens: config.maxTokens ?? inputs.maxTokens ?? 2048,
                parseAs: config.parseAs === 'json' ? 'json' : 'text',
                providerId: inputs._aiProviderId || undefined,
            });

            if (!response.success) {
                return { success: false, error: response.error || 'LLM call failed' };
            }

            const responseText = response.text || '';
            const wasTruncated = response.wasTruncated || false;

            if (wasTruncated) {
                console.warn('[LLM-Agent] Response was truncated due to token limit.');
            }

            // Use parsed data from AI service if JSON mode, otherwise use text
            const parsedData = config.parseAs === 'json' && response.data
                ? response.data
                : responseText;

            // Return data only - node creation is handled by execution engine
            // based on manifest.executor.createNodes and manifest.executor.nodeConfig
            return { success: true, data: parsedData };
        } catch (error: any) {
            return { success: false, error: error.message || 'LLM call failed' };
        }
    };
};
