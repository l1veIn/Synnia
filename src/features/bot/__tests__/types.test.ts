/**
 * Bot Types Tests
 *
 * Tests for bot type definitions and constants.
 */

import { describe, it, expect } from 'vitest';
import { DEFAULT_SYSTEM_PROMPT, MAX_CONTEXT_MESSAGES } from '../types';
import type { BotMessage, BotMessageRole, ToolCall, ToolDefinition, ChatRequest } from '../types';

describe('Bot Types', () => {
    describe('Constants', () => {
        it('should have a defined system prompt', () => {
            expect(DEFAULT_SYSTEM_PROMPT).toBeDefined();
            expect(typeof DEFAULT_SYSTEM_PROMPT).toBe('string');
            expect(DEFAULT_SYSTEM_PROMPT.length).toBeGreaterThan(0);
        });

        it('should have a max context messages limit', () => {
            expect(MAX_CONTEXT_MESSAGES).toBeDefined();
            expect(typeof MAX_CONTEXT_MESSAGES).toBe('number');
            expect(MAX_CONTEXT_MESSAGES).toBe(10);
        });
    });

    describe('BotMessage', () => {
        it('should accept valid message shapes', () => {
            const userMessage: BotMessage = {
                id: 'msg_1',
                role: 'user',
                content: 'Hello',
                timestamp: Date.now(),
            };

            const assistantMessage: BotMessage = {
                id: 'msg_2',
                role: 'assistant',
                content: 'Hi there!',
                timestamp: Date.now(),
                toolCalls: [],
            };

            expect(userMessage.role).toBe('user');
            expect(assistantMessage.role).toBe('assistant');
            expect(assistantMessage.toolCalls).toEqual([]);
        });
    });

    describe('ToolCall', () => {
        it('should accept valid tool call shapes', () => {
            const toolCall: ToolCall = {
                id: 'tool_1',
                name: 'get_nodes_list',
                arguments: {},
            };

            expect(toolCall.name).toBe('get_nodes_list');
        });
    });

    describe('ToolDefinition', () => {
        it('should accept valid tool definition shapes', () => {
            const toolDef: ToolDefinition = {
                name: 'create_node',
                description: 'Create a new node',
                parameters: {
                    type: 'object',
                    properties: {
                        nodeType: { type: 'string' },
                        value: { type: 'string' },
                    },
                },
            };

            expect(toolDef.name).toBe('create_node');
            expect(toolDef.parameters).toBeDefined();
        });
    });

    describe('ChatRequest', () => {
        it('should accept valid chat request shapes', () => {
            const request: ChatRequest = {
                messages: [
                    {
                        id: 'msg_1',
                        role: 'user',
                        content: 'Hello',
                        timestamp: Date.now(),
                    },
                ],
                systemPrompt: 'You are a helpful assistant',
                tools: [],
            };

            expect(request.messages).toHaveLength(1);
            expect(request.systemPrompt).toBeDefined();
            expect(request.tools).toEqual([]);
        });
    });
});
