/**
 * Tool Executor
 * 
 * Utility for executing frontend tools from the ChatModelAdapter.
 * This is a workaround for LocalRuntime not automatically executing tools.
 * 
 * When assistant-ui fixes this issue, this module can be removed and
 * tools will execute automatically via makeAssistantTool's execute function.
 */

import type { ChatModelRunOptions } from '@assistant-ui/react';

export interface ToolCallInfo {
    toolCallId: string;
    toolName: string;
    args: Record<string, unknown>;
}

export interface ToolExecutionResult {
    toolCallId: string;
    toolName: string;
    args: Record<string, unknown>;
    argsText: string;
    result?: unknown;
}

/**
 * Execute a single tool call using the registered frontend tools.
 * Returns the tool-call part with result included (if execution succeeded).
 */
export async function executeToolCall(
    toolCall: ToolCallInfo,
    context: ChatModelRunOptions['context'],
    abortSignal?: AbortSignal
): Promise<ToolExecutionResult> {
    const result: ToolExecutionResult = {
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        args: toolCall.args,
        argsText: JSON.stringify(toolCall.args),
    };

    const contextTools = context?.tools;
    const toolDef = contextTools?.[toolCall.toolName];

    if (toolDef && typeof toolDef.execute === 'function') {
        console.log(`[ToolExecutor] Executing: ${toolCall.toolName}`, 'args:', toolCall.args);
        try {
            const toolResult = await toolDef.execute(toolCall.args, {
                toolCallId: toolCall.toolCallId,
                abortSignal,
                human: undefined, // Not a human-in-the-loop call
            } as any);
            console.log(`[ToolExecutor] ${toolCall.toolName} result:`, toolResult);
            result.result = toolResult;
        } catch (error) {
            console.error(`[ToolExecutor] ${toolCall.toolName} error:`, error);
            result.result = {
                error: error instanceof Error ? error.message : 'Tool execution failed'
            };
        }
    } else {
        console.warn(`[ToolExecutor] No execute function for: ${toolCall.toolName}`);
    }

    return result;
}

/**
 * Execute multiple tool calls in sequence.
 * Returns an array of tool-call parts with results.
 */
export async function executeToolCalls(
    toolCalls: ToolCallInfo[],
    context: ChatModelRunOptions['context'],
    abortSignal?: AbortSignal
): Promise<ToolExecutionResult[]> {
    const results: ToolExecutionResult[] = [];

    for (const toolCall of toolCalls) {
        const result = await executeToolCall(toolCall, context, abortSignal);
        results.push(result);
    }

    return results;
}

/**
 * Convert AI SDK tool calls to our ToolCallInfo format.
 * Note: AI SDK uses 'input' field, not 'args'
 */
export function parseAiSdkToolCalls(toolCalls: any[]): ToolCallInfo[] {
    return toolCalls.map(tc => ({
        toolCallId: tc.toolCallId,
        toolName: tc.toolName,
        args: tc.input ?? tc.args ?? {},
    }));
}

/**
 * Convert ToolExecutionResult to assistant-ui message content parts.
 */
export function toMessageContentParts(results: ToolExecutionResult[]): any[] {
    return results.map(r => ({
        type: 'tool-call' as const,
        toolCallId: r.toolCallId,
        toolName: r.toolName,
        args: r.args,
        argsText: r.argsText,
        result: r.result,
    }));
}
