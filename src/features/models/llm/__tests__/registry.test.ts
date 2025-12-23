// LLM Registry Tests
// Tests for LLM plugin registration and retrieval

import { describe, it, expect, beforeAll } from 'vitest';
import {
    llmRegistry,
    getLLMPlugin,
    getAllLLMPlugins,
    getLLMModelsForCapability,
} from '../registry';
import { LLMPlugin, LLMCapability } from '../../types';

// Mock plugin for testing
const createMockPlugin = (id: string, overrides?: Partial<LLMPlugin>): LLMPlugin => ({
    id,
    name: `Test ${id}`,
    category: 'llm', // Unified LLM category
    provider: 'openai',
    supportedProviders: ['openai'],
    capabilities: ['chat'],
    contextWindow: 4096,
    maxOutputTokens: 2048,
    defaultTemperature: 0.7,
    renderConfig: () => null,  // Required for unified ModelPlugin
    execute: async () => ({ success: true, text: 'test' }),
    ...overrides,
});

describe('llmRegistry', () => {
    // Register test plugins before tests
    beforeAll(() => {
        // These won't interfere with production plugins since we use unique IDs
        llmRegistry.register(createMockPlugin('test-llm-1'));
        llmRegistry.register(createMockPlugin('test-llm-2', {
            capabilities: ['chat', 'vision'],
        }));
        llmRegistry.register(createMockPlugin('test-llm-3', {
            provider: 'anthropic',
            supportedProviders: ['anthropic'],
            capabilities: ['chat', 'json-mode'],
        }));
    });

    describe('getLLMPlugin', () => {
        it('should return undefined for unknown ID', () => {
            expect(getLLMPlugin('nonexistent-llm')).toBeUndefined();
        });

        it('should return registered plugin by ID', () => {
            const plugin = getLLMPlugin('test-llm-1');
            expect(plugin).toBeDefined();
            expect(plugin?.id).toBe('test-llm-1');
        });
    });

    describe('getAllLLMPlugins', () => {
        it('should return array of plugins', () => {
            const plugins = getAllLLMPlugins();
            expect(Array.isArray(plugins)).toBe(true);
            expect(plugins.length).toBeGreaterThan(0);
        });

        it('should include test plugins', () => {
            const plugins = getAllLLMPlugins();
            const ids = plugins.map(p => p.id);
            expect(ids).toContain('test-llm-1');
            expect(ids).toContain('test-llm-2');
        });
    });

    describe('getLLMModelsForCapability', () => {
        it('should filter by vision capability', () => {
            const visionModels = getLLMModelsForCapability('vision');
            expect(visionModels.some(m => m.id === 'test-llm-2')).toBe(true);
            expect(visionModels.some(m => m.id === 'test-llm-1')).toBe(false);
        });

        it('should filter by json-mode capability', () => {
            const jsonModels = getLLMModelsForCapability('json-mode');
            expect(jsonModels.some(m => m.id === 'test-llm-3')).toBe(true);
        });

        it('should return all chat models', () => {
            const chatModels = getLLMModelsForCapability('chat');
            // All our test models have chat capability
            expect(chatModels.some(m => m.id === 'test-llm-1')).toBe(true);
            expect(chatModels.some(m => m.id === 'test-llm-2')).toBe(true);
            expect(chatModels.some(m => m.id === 'test-llm-3')).toBe(true);
        });
    });

    describe('llmRegistry.getByProvider', () => {
        it('should filter by openai provider', () => {
            const openaiModels = llmRegistry.getByProvider('openai');
            expect(openaiModels.some(m => m.id === 'test-llm-1')).toBe(true);
            expect(openaiModels.some(m => m.id === 'test-llm-3')).toBe(false);
        });

        it('should filter by anthropic provider', () => {
            const anthropicModels = llmRegistry.getByProvider('anthropic');
            expect(anthropicModels.some(m => m.id === 'test-llm-3')).toBe(true);
        });
    });
});
