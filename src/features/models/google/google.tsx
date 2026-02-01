// Google Gemini LLM Plugins
// Unified with ModelPlugin interface

import { generateText, streamText, tool as aiTool, zodSchema } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { ModelPlugin, ModelExecutionInput, ModelExecutionResult, HandleSpec } from '../types';
import { extractJson } from '../utils';
import { DefaultLLMSettings } from '../shared/DefaultLLMSettings';
import type { ChatModelAdapter, ChatModelRunOptions } from '@assistant-ui/react';
import { parseAiSdkToolCalls, executeToolCalls, toMessageContentParts } from '../../chat/utils/toolExecutor';

// ============================================================================
// Shared Google Execution Logic
// ============================================================================

async function executeGoogle(
    input: ModelExecutionInput,
    modelId: string
): Promise<ModelExecutionResult> {
    const { systemPrompt, temperature, jsonMode } = input;
    const userPrompt = input.userPrompt || input.prompt || '';

    try {
        console.log('[Google]: Calling backend execute_model');
        const { invoke } = await import('@tauri-apps/api/core');

        // Build the prompt including system prompt if present
        let prompt = userPrompt;
        if (systemPrompt) {
            prompt = `System: ${systemPrompt}\n\nUser: ${userPrompt}`;
        }

        // Call backend execute_model
        const result = await invoke<{
            success: boolean;
            error?: string;
            text?: string;
            images?: { url: string; width?: number; height?: number }[];
            videoUrl?: string;
        }>('execute_model', {
            provider: 'google',
            modelId: modelId,
            input: {
                prompt: prompt,
                config: {
                    temperature: temperature ?? 0.7,
                },
                category: 'llm',
            }
        });

        if (!result.success) {
            return { success: false, error: result.error || 'Backend execution failed' };
        }

        const responseText = result.text || '';

        if (jsonMode) {
            const { data, success } = extractJson(responseText);
            if (success) {
                return { success: true, text: responseText, data };
            } else {
                return { success: false, text: responseText, error: 'Failed to parse JSON' };
            }
        }

        return { success: true, text: responseText };
    } catch (error: any) {
        console.error('[Google] Backend call failed:', error);
        return { success: false, error: error.message || 'Google backend call failed' };
    }
}

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
    // Gemini 3 specific
    thinkingLevel?: 'low' | 'medium' | 'high';
}

// Convert assistant-ui tools to AI SDK tools format
function convertToolsForAiSdk(context: ChatModelRunOptions['context']) {
    const contextTools = context?.tools;
    if (!contextTools) return undefined;

    const tools: Record<string, any> = {};

    for (const [name, toolDef] of Object.entries(contextTools)) {
        if (toolDef && toolDef.parameters) {
            // Use zodSchema() to properly convert Zod schema to JSON Schema
            const jsonSchema = zodSchema(toolDef.parameters as any);
            console.log(`[Tool Schema] ${name}:`, JSON.stringify(jsonSchema, null, 2));

            // Create tool with execute function for AI SDK multi-step support
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tools[name] = aiTool({
                description: toolDef.description || `Tool: ${name}`,
                parameters: jsonSchema,
                // Add execute function so AI SDK can auto-execute for maxSteps
                execute: async (args: any) => {
                    if (toolDef.execute && typeof toolDef.execute === 'function') {
                        console.log(`[AI SDK Tool Execute] ${name}`, args);
                        try {
                            const result = await toolDef.execute(args, {
                                toolCallId: `auto-${Date.now()}`,
                                abortSignal: undefined,
                            } as any);
                            console.log(`[AI SDK Tool Execute] ${name} result:`, result);
                            return result;
                        } catch (error) {
                            console.error(`[AI SDK Tool Execute] ${name} error:`, error);
                            return { error: error instanceof Error ? error.message : 'Tool execution failed' };
                        }
                    }
                    return { error: `No execute function for ${name}` };
                },
            } as any);
        }
    }

    return Object.keys(tools).length > 0 ? tools : undefined;
}

const createGeminiModel = (config: GeminiModelConfig): ModelPlugin => ({
    id: config.id,
    name: config.name,
    description: config.description,
    category: 'llm',  // Unified LLM category
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

    execute: (input) => executeGoogle(input as ModelExecutionInput, config.id),

    getChatAdapter: (credentials, modelConfig): ChatModelAdapter => ({
        async *run({ messages, abortSignal, context }) {
            try {
                const google = createGoogleGenerativeAI({
                    apiKey: credentials.apiKey,
                    baseURL: credentials.baseUrl?.includes('generativelanguage.googleapis.com')
                        ? undefined
                        : credentials.baseUrl,
                });

                const model = google(config.id);

                // Convert assistant-ui ThreadMessage to AI SDK CoreMessage format
                const aiMessages: any[] = [];

                for (const msg of messages) {
                    const msgRole = msg.role as string;
                    const content = msg.content as any[];

                    if (msgRole === 'tool') {
                        const toolResults = content
                            .filter((part: any) => part.type === 'tool-result')
                            .map((part: any) => ({
                                type: 'tool-result' as const,
                                toolCallId: part.toolCallId,
                                result: part.result,
                            }));

                        if (toolResults.length > 0) {
                            aiMessages.push({
                                role: 'tool',
                                content: toolResults,
                            });
                        }
                    } else if (msgRole === 'assistant') {
                        const textParts = content.filter((part: any) => part.type === 'text');
                        const textContent = textParts.map((part: any) => part.text).join('');

                        // Also check for tool calls in assistant message
                        const toolCallParts = content.filter((part: any) => part.type === 'tool-call');

                        if (textContent || toolCallParts.length > 0) {
                            aiMessages.push({
                                role: 'assistant',
                                content: textContent || '',
                            });
                        }
                    } else if (msgRole === 'user') {
                        const textParts = content.filter((part: any) => part.type === 'text');
                        aiMessages.push({
                            role: 'user',
                            content: textParts.map((part: any) => part.text).join(''),
                        });
                    } else if (msgRole === 'system') {
                        const textParts = content.filter((part: any) => part.type === 'text');
                        aiMessages.push({
                            role: 'system',
                            content: textParts.map((part: any) => part.text).join(''),
                        });
                    }
                }

                // Only add tools if context has them
                const tools = convertToolsForAiSdk(context);

                console.log('[Gemini] Starting streamText with', aiMessages.length, 'messages');
                if (tools) {
                    console.log('[Gemini] Tools:', Object.keys(tools));
                }

                const result = streamText({
                    model,
                    messages: aiMessages,
                    temperature: modelConfig?.temperature ?? 1.0, // Gemini 3 recommends 1.0
                    maxOutputTokens: modelConfig?.maxTokens ?? config.maxOutputTokens,
                    abortSignal,
                    tools,
                    // Allow multi-step tool calling (e.g., query then delete)
                    // @ts-expect-error - maxSteps is valid in AI SDK 5.x but types may be outdated
                    maxSteps: 5,
                    // Gemini 3 thinking config - use 'low' for faster tool calling
                    providerOptions: config.thinkingLevel ? {
                        google: {
                            thinkingConfig: {
                                thinkingLevel: config.thinkingLevel,
                            },
                        },
                    } : undefined,
                    onError: (event) => {
                        console.error('[Gemini] Stream error event:', event.error);
                    },
                });

                // Use fullStream for multi-step support
                // AI SDK will automatically execute tools and loop with maxSteps
                let accumulatedText = '';
                const toolCallParts: any[] = [];

                for await (const part of result.fullStream) {
                    if (part.type === 'text-delta') {
                        // fullStream uses 'text' not 'textDelta'
                        accumulatedText += (part as any).text || (part as any).textDelta || '';
                        yield {
                            content: [{ type: 'text' as const, text: accumulatedText }]
                        };
                    } else if (part.type === 'tool-call') {
                        // Tool was called - AI SDK already executed it via our execute function
                        // AI SDK uses 'input' instead of 'args'
                        const p = part as any;
                        const args = p.args || p.input || {};
                        console.log('[Gemini] Tool call:', part.toolName, args);
                        toolCallParts.push({
                            type: 'tool-call' as const,
                            toolCallId: part.toolCallId,
                            toolName: part.toolName,
                            args: args,
                            argsText: JSON.stringify(args),
                        });
                    } else if (part.type === 'tool-result') {
                        // Tool result - add to the corresponding tool call
                        // AI SDK uses 'output' instead of 'result'
                        const p = part as any;
                        const result = p.result || p.output;
                        console.log('[Gemini] Tool result:', part.toolName, result);
                        const existingCall = toolCallParts.find(tc => tc.toolCallId === part.toolCallId);
                        if (existingCall) {
                            existingCall.result = result;
                        }
                    }
                }

                // If we had tool calls, yield them
                if (toolCallParts.length > 0) {
                    yield {
                        content: [
                            ...toolCallParts,
                            ...(accumulatedText ? [{ type: 'text' as const, text: accumulatedText }] : []),
                        ] as any,
                    };
                } else if (!accumulatedText) {
                    // If no text and no tool calls, yield empty text
                    yield { content: [{ type: 'text' as const, text: '' }] };
                }
            } catch (error) {
                console.error('[Gemini] Adapter error:', error);
                yield {
                    content: [{
                        type: 'text' as const,
                        text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
                    }]
                };
            }
        }
    }),
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
    thinkingLevel: 'low', // Use low for faster tool calling
});

export const gemini3Flash = createGeminiModel({
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3.0 Flash',
    description: 'Fast Gemini 3 Flash preview with improved tool calling',
    hasVision: true,
    contextWindow: 1000000,
    maxOutputTokens: 32768,
    thinkingLevel: 'low', // Use low for faster responses
});
