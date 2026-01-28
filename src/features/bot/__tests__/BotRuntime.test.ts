/**
 * BotRuntime Unit Tests
 *
 * Tests for the Bot runtime functionality without React Testing Library.
 * These tests focus on the logic and types rather than React integration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_SYSTEM_PROMPT, MAX_CONTEXT_MESSAGES } from '../types';
import type { BotMessage, BotMessageRole, ToolCall, ToolDefinition, ChatRequest } from '../types';

describe('Bot Runtime Unit Tests', () => {
    describe('Constants', () => {
        it('should have a defined system prompt', () => {
            expect(DEFAULT_SYSTEM_PROMPT).toBeDefined();
            expect(typeof DEFAULT_SYSTEM_PROMPT).toBe('string');
            expect(DEFAULT_SYSTEM_PROMPT.length).toBeGreaterThan(0);
            expect(DEFAULT_SYSTEM_PROMPT).toContain('Synnia');
            expect(DEFAULT_SYSTEM_PROMPT).toContain('canvas');
        });

        it('should have a max context messages limit', () => {
            expect(MAX_CONTEXT_MESSAGES).toBeDefined();
            expect(typeof MAX_CONTEXT_MESSAGES).toBe('number');
            expect(MAX_CONTEXT_MESSAGES).toBe(10);
        });
    });

    describe('BotMessage Types', () => {
        it('should accept valid user message shapes', () => {
            const userMessage: BotMessage = {
                id: 'msg_1',
                role: 'user',
                content: 'Hello',
                timestamp: Date.now(),
            };

            expect(userMessage.role).toBe('user');
            expect(userMessage.content).toBe('Hello');
            expect(userMessage.id).toBeDefined();
            expect(userMessage.timestamp).toBeDefined();
        });

        it('should accept valid assistant message shapes', () => {
            const toolCall: ToolCall = {
                id: 'tool_1',
                name: 'get_nodes_list',
                arguments: {},
            };

            const assistantMessage: BotMessage = {
                id: 'msg_2',
                role: 'assistant',
                content: 'Hi there!',
                timestamp: Date.now(),
                toolCalls: [toolCall],
            };

            expect(assistantMessage.role).toBe('assistant');
            expect(assistantMessage.toolCalls).toHaveLength(1);
            expect(assistantMessage.toolCalls?.[0].name).toBe('get_nodes_list');
        });

        it('should accept system message shapes', () => {
            const systemMessage: BotMessage = {
                id: 'msg_0',
                role: 'system',
                content: 'You are a helpful assistant',
                timestamp: Date.now(),
            };

            expect(systemMessage.role).toBe('system');
        });

        it('should accept messages with metadata', () => {
            const messageWithMeta: BotMessage = {
                id: 'msg_3',
                role: 'user',
                content: 'Test',
                timestamp: Date.now(),
                metadata: {
                    model: 'gpt-4',
                    temperature: 0.7,
                },
            };

            expect(messageWithMeta.metadata).toBeDefined();
            expect(messageWithMeta.metadata?.model).toBe('gpt-4');
        });
    });

    describe('ToolCall Types', () => {
        it('should accept valid tool call shapes', () => {
            const toolCall: ToolCall = {
                id: 'tool_1',
                name: 'get_nodes_list',
                arguments: {},
            };

            expect(toolCall.name).toBe('get_nodes_list');
            expect(toolCall.arguments).toBeDefined();
        });

        it('should accept tool calls with result', () => {
            const toolCallWithResult: ToolCall = {
                id: 'tool_2',
                name: 'create_node',
                arguments: {
                    nodeType: 'text',
                    value: 'Hello',
                },
                result: {
                    success: true,
                    nodeId: 'node_123',
                },
            };

            expect(toolCallWithResult.result).toBeDefined();
        });
    });

    describe('ToolDefinition Types', () => {
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
            expect(toolDef.description).toBeDefined();
            expect(toolDef.parameters).toBeDefined();
        });
    });

    describe('ChatRequest Types', () => {
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

        it('should accept requests with tools', () => {
            const toolDef: ToolDefinition = {
                name: 'get_nodes_list',
                description: 'Get all nodes',
                parameters: {},
            };

            const request: ChatRequest = {
                messages: [],
                systemPrompt: 'System prompt',
                tools: [toolDef],
                modelId: 'gpt-4',
            };

            expect(request.tools).toHaveLength(1);
            expect(request.tools[0].name).toBe('get_nodes_list');
            expect(request.modelId).toBe('gpt-4');
        });
    });

    describe('Message Role Types', () => {
        it('should support all required roles', () => {
            const roles: BotMessageRole[] = ['user', 'assistant', 'system'];

            roles.forEach((role) => {
                expect(role).toBeDefined();
                expect(['user', 'assistant', 'system']).toContain(role);
            });
        });
    });
});
