// @ts-nocheck
// Agent Executor Tests
// Tests for AI model execution (LLM, Image Gen, Video Gen)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentExecutor } from '../AgentExecutor';
import { ExecutionContext, RecipeManifest } from '@/types/recipe';
import type { ModelPlugin } from '@features/models/types';

// ============================================================================
// Mocks
// ============================================================================

// Mock modelRegistry
const mockModelRegistryGet = vi.fn();
vi.mock('@features/models', () => ({
    modelRegistry: {
        get: (id: string) => mockModelRegistryGet(id),
    },
}));

// Mock settings
const mockGetSettings = vi.fn();
const mockGetProviderCredentials = vi.fn();
vi.mock('@/lib/settings', () => ({
    getSettings: () => mockGetSettings(),
    getProviderCredentials: (settings: Record<string, unknown>, provider: string) => mockGetProviderCredentials(settings, provider),
}));

// Mock promptUtils
const mockInterpolate = vi.fn();
vi.mock('@features/recipes/promptUtils', () => ({
    interpolate: (template: string, values: Record<string, unknown>) => mockInterpolate(template, values),
}));

// Mock models utils
const mockExtractJson = vi.fn();
vi.mock('@features/models/utils', () => ({
    extractJson: (text: string) => mockExtractJson(text),
}));

// Mock apiClient
const mockSaveProcessedImage = vi.fn();
const mockDownloadAndSaveImage = vi.fn();
vi.mock('@/lib/apiClient', () => ({
    apiClient: {
        saveProcessedImage: (data: string) => mockSaveProcessedImage(data),
        downloadAndSaveImage: (url: string) => mockDownloadAndSaveImage(url),
    },
}));

// ============================================================================
// Test Helpers
// ============================================================================

const defaultSettings = {
    providers: {
        openai: { apiKey: 'test-api-key' },
        anthropic: { apiKey: 'test-anthropic-key' },
        fal: { apiKey: 'test-fal-key' },
        replicate: { apiKey: 'test-replicate-key' },
    },
    defaultModels: {},
    _version: 4,
};

function createMockModelPlugin(overrides?: Partial<ModelPlugin>): ModelPlugin {
    return {
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: 'Test model',
        category: 'llm',
        provider: 'openai',
        capabilities: ['chat', 'json-mode'],
        renderConfig: vi.fn(),
        execute: vi.fn(),
        ...overrides,
    };
}

function createMockContext(
    overrides?: Partial<ExecutionContext>
): ExecutionContext {
    const manifest: RecipeManifest = {
        version: 1,
        id: 'test-recipe',
        name: 'Test Recipe',
        executor: {
            type: 'agent',
            model: {
                category: 'llm',
                defaultParams: {
                    temperature: 0.7,
                    maxTokens: 2048,
                },
            },
        },
        output: { node: 'form' },
    };

    return {
        manifest,
        inputs: { prompt: 'test prompt' },
        nodeId: 'node-1',
        engine: {} as never,
        node: {} as never,
        ...overrides,
    };
}

function createMockAsset(promptConfig?: { system?: string; user?: string }) {
    return {
        config: {
            extra: {
                prompt: promptConfig || {
                    system: 'You are a helpful assistant.',
                    user: 'Help me with {{topic}}',
                },
            },
        },
    };
}

// ============================================================================
// Tests
// ============================================================================

describe('AgentExecutor', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Setup default mock behaviors
        mockGetSettings.mockReturnValue(defaultSettings);
        mockGetProviderCredentials.mockImplementation((settings: Record<string, unknown>, provider: string) => {
            const creds = settings?.providers?.[provider];
            if (creds?.apiKey) return { apiKey: creds.apiKey };
            if (creds?.baseUrl) return { baseUrl: creds.baseUrl };
            return { apiKey: 'mock-api-key' }; // Default to having some credential
        });
        mockInterpolate.mockImplementation((template: string, values: Record<string, unknown>) => {
            if (typeof template !== 'string') return template;
            return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
                const val = values[key];
                return val !== undefined ? String(val) : '';
            });
        });
        mockExtractJson.mockImplementation((text: string) => {
            try {
                const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
                const jsonText = jsonMatch ? jsonMatch[1] : text;
                const data = JSON.parse(jsonText);
                return { data, success: true };
            } catch {
                return { data: null, success: false };
            }
        });
        mockSaveProcessedImage.mockResolvedValue({
            assetId: 'asset-123',
            relativePath: 'images/image.png',
            thumbnailPath: null,
            width: 512,
            height: 512,
        });
        mockDownloadAndSaveImage.mockResolvedValue({
            assetId: 'asset-456',
            relativePath: 'images/downloaded.png',
            thumbnailPath: null,
            width: 512,
            height: 512,
        });
    });

    describe('canHandle', () => {
        it('should return true for agent executor type', () => {
            const manifest: RecipeManifest = {
                version: 1,
                id: 'test',
                name: 'Test',
                executor: {
                    type: 'agent',
                    model: { category: 'llm' },
                },
                output: { node: 'text' },
            };

            expect(AgentExecutor.canHandle(manifest)).toBe(true);
        });

        it('should return true when executor type is undefined (defaults to agent)', () => {
            const manifest: RecipeManifest = {
                version: 1,
                id: 'test',
                name: 'Test',
                executor: undefined as never,
                output: { node: 'text' },
            };

            expect(AgentExecutor.canHandle(manifest)).toBe(true);
        });

        it('should return false for http executor type', () => {
            const manifest: RecipeManifest = {
                version: 1,
                id: 'test',
                name: 'Test',
                executor: {
                    type: 'http',
                    endpoint: 'https://api.example.com',
                },
                output: { node: 'text' },
            };

            expect(AgentExecutor.canHandle(manifest)).toBe(false);
        });
    });

    describe('execute - validation', () => {
        it('should return error when no model is selected', async () => {
            const ctx = createMockContext({
                modelConfig: { modelId: undefined as never },
            });

            const result = await AgentExecutor.execute(ctx);

            expect(result).toEqual({
                success: false,
                error: 'No model selected',
            });
        });

        it('should return error when model is not found in registry', async () => {
            mockModelRegistryGet.mockReturnValue(undefined);

            const ctx = createMockContext({
                modelConfig: { modelId: 'non-existent-model' },
            });

            const result = await AgentExecutor.execute(ctx);

            expect(result).toEqual({
                success: false,
                error: 'Model not found: non-existent-model',
            });
        });

        it('should return error when no credentials configured for non-local model', async () => {
            const mockModel = createMockModelPlugin({ isLocal: false });
            mockModelRegistryGet.mockReturnValue(mockModel);
            mockGetProviderCredentials.mockReturnValue(null);

            const ctx = createMockContext({
                modelConfig: { modelId: 'gpt-4o', provider: 'openai' },
            });

            const result = await AgentExecutor.execute(ctx);

            expect(result).toEqual({
                success: false,
                error: 'No credentials configured for openai',
            });
        });

        it('should allow execution for local models without credentials', async () => {
            const mockExecute = vi.fn().mockResolvedValue({
                success: true,
                text: 'Response from local model',
            });
            const mockModel = createMockModelPlugin({
                isLocal: true,
                provider: 'ollama',
                execute: mockExecute,
            });
            mockModelRegistryGet.mockReturnValue(mockModel);
            // Clear mock and return null for local models
            mockGetProviderCredentials.mockClear();
            mockGetProviderCredentials.mockReturnValue(null);

            const ctx = createMockContext({
                modelConfig: { modelId: 'llama-2', provider: 'ollama' },
                asset: createMockAsset(),
                manifest: {
                    version: 1,
                    id: 'test',
                    name: 'Test',
                    executor: {
                        type: 'agent',
                        model: { category: 'llm' },
                    },
                    output: { node: 'text' },  // Text output, not JSON
                },
            });

            const result = await AgentExecutor.execute(ctx);

            expect(result.success).toBe(true);
            expect(result.data).toBe('Response from local model');
        });
    });

    describe('execute - LLM execution', () => {
        it('should execute LLM model with text output', async () => {
            const mockExecute = vi.fn().mockResolvedValue({
                success: true,
                text: 'This is a response',
            });
            const mockModel = createMockModelPlugin({
                category: 'llm',
                execute: mockExecute,
            });
            mockModelRegistryGet.mockReturnValue(mockModel);

            const ctx = createMockContext({
                modelConfig: {
                    modelId: 'gpt-4o',
                    provider: 'openai',
                    params: { temperature: 0.5, maxTokens: 1000 },
                },
                manifest: {
                    version: 1,
                    id: 'test',
                    name: 'Test',
                    executor: {
                        type: 'agent',
                        model: { category: 'llm' },
                    },
                    output: { node: 'text' },
                },
                asset: createMockAsset(),
            });

            const result = await AgentExecutor.execute(ctx);

            expect(result.success).toBe(true);
            expect(result.data).toBe('This is a response');
            expect(mockExecute).toHaveBeenCalledWith(
                expect.objectContaining({
                    temperature: 0.5,
                    maxTokens: 1000,
                })
            );
        });

        it('should use default params from manifest when modelConfig params are missing', async () => {
            const mockExecute = vi.fn().mockResolvedValue({
                success: true,
                text: '{"result": "success"}',  // Return JSON to match default output type
            });
            const mockModel = createMockModelPlugin({
                category: 'llm',
                provider: 'openai',
                execute: mockExecute,
            });
            mockModelRegistryGet.mockReturnValue(mockModel);
            // Clear and set up mock to return proper credentials for openai
            mockGetProviderCredentials.mockClear();
            mockGetProviderCredentials.mockReturnValue({ apiKey: 'test-api-key' });

            const ctx = createMockContext({
                modelConfig: { modelId: 'gpt-4o', provider: 'openai' },
                asset: createMockAsset(),
            });

            const result = await AgentExecutor.execute(ctx);

            expect(result.success).toBe(true);
            expect(mockExecute).toHaveBeenCalledWith(
                expect.objectContaining({
                    temperature: 0.7,
                    maxTokens: 2048,
                })
            );
        });

        it('should parse JSON response for non-text output nodes', async () => {
            const mockExecute = vi.fn().mockResolvedValue({
                success: true,
                text: '{"result": "data", "count": 42}',
            });
            const mockModel = createMockModelPlugin({
                category: 'llm',
                execute: mockExecute,
            });
            mockModelRegistryGet.mockReturnValue(mockModel);

            const ctx = createMockContext({
                modelConfig: { modelId: 'gpt-4o', provider: 'openai' },
                asset: createMockAsset(),
            });

            const result = await AgentExecutor.execute(ctx);

            expect(result.success).toBe(true);
            expect(result.data).toEqual({ result: 'data', count: 42 });
        });

        it('should parse JSON from markdown code blocks', async () => {
            const mockExecute = vi.fn().mockResolvedValue({
                success: true,
                text: '```json\n{"items": ["a", "b", "c"]}\n```',
            });
            const mockModel = createMockModelPlugin({
                category: 'llm',
                execute: mockExecute,
            });
            mockModelRegistryGet.mockReturnValue(mockModel);
            mockExtractJson.mockReturnValue({
                success: true,
                data: { items: ['a', 'b', 'c'] },
            });

            const ctx = createMockContext({
                modelConfig: { modelId: 'gpt-4o', provider: 'openai' },
                asset: createMockAsset(),
            });

            const result = await AgentExecutor.execute(ctx);

            expect(result.success).toBe(true);
            expect(result.data).toEqual({ items: ['a', 'b', 'c'] });
        });

        it('should return error when JSON parsing fails', async () => {
            const mockExecute = vi.fn().mockResolvedValue({
                success: true,
                text: 'Invalid JSON {{{',
            });
            const mockModel = createMockModelPlugin({
                category: 'llm',
                execute: mockExecute,
            });
            mockModelRegistryGet.mockReturnValue(mockModel);
            mockExtractJson.mockReturnValue({
                success: false,
                data: null,
            });

            const ctx = createMockContext({
                modelConfig: { modelId: 'gpt-4o', provider: 'openai' },
                asset: createMockAsset(),
            });

            const result = await AgentExecutor.execute(ctx);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to parse JSON response');
        });

        it('should return text directly when output node is text', async () => {
            const mockExecute = vi.fn().mockResolvedValue({
                success: true,
                text: 'Plain text response',
            });
            const mockModel = createMockModelPlugin({
                category: 'llm',
                execute: mockExecute,
            });
            mockModelRegistryGet.mockReturnValue(mockModel);

            const ctx = createMockContext({
                modelConfig: { modelId: 'gpt-4o', provider: 'openai' },
                manifest: {
                    version: 1,
                    id: 'test',
                    name: 'Test',
                    executor: {
                        type: 'agent',
                        model: { category: 'llm' },
                    },
                    output: { node: 'text' },
                },
                asset: createMockAsset(),
            });

            const result = await AgentExecutor.execute(ctx);

            expect(result.success).toBe(true);
            expect(result.data).toBe('Plain text response');
        });

        it('should disable jsonMode for text output nodes', async () => {
            const mockExecute = vi.fn().mockResolvedValue({
                success: true,
                text: 'Response',
            });
            const mockModel = createMockModelPlugin({
                category: 'llm',
                execute: mockExecute,
            });
            mockModelRegistryGet.mockReturnValue(mockModel);

            const ctx = createMockContext({
                modelConfig: { modelId: 'gpt-4o', provider: 'openai' },
                manifest: {
                    version: 1,
                    id: 'test',
                    name: 'Test',
                    executor: {
                        type: 'agent',
                        model: { category: 'llm' },
                    },
                    output: { node: 'text' },
                },
                asset: createMockAsset(),
            });

            await AgentExecutor.execute(ctx);

            expect(mockExecute).toHaveBeenCalledWith(
                expect.objectContaining({
                    jsonMode: false,
                })
            );
        });

        it('should enable jsonMode by default for non-text output nodes', async () => {
            const mockExecute = vi.fn().mockResolvedValue({
                success: true,
                text: '{"result": true}',
            });
            const mockModel = createMockModelPlugin({
                category: 'llm',
                execute: mockExecute,
            });
            mockModelRegistryGet.mockReturnValue(mockModel);

            const ctx = createMockContext({
                modelConfig: { modelId: 'gpt-4o', provider: 'openai' },
                asset: createMockAsset(),
            });

            await AgentExecutor.execute(ctx);

            expect(mockExecute).toHaveBeenCalledWith(
                expect.objectContaining({
                    jsonMode: true,
                })
            );
        });

        it('should use system prompt from asset config', async () => {
            const mockExecute = vi.fn().mockResolvedValue({
                success: true,
                text: 'Response',
            });
            const mockModel = createMockModelPlugin({
                category: 'llm',
                provider: 'openai',
                execute: mockExecute,
            });
            mockModelRegistryGet.mockReturnValue(mockModel);

            // Reset mockInterpolate to use default implementation
            mockInterpolate.mockImplementation((template: string, values: Record<string, unknown>) => {
                if (typeof template !== 'string') return template;
                return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
                    const val = values[key];
                    return val !== undefined ? String(val) : '';
                });
            });

            const ctx = createMockContext({
                modelConfig: { modelId: 'gpt-4o', provider: 'openai' },
                asset: createMockAsset({
                    system: 'You are {{role}}',
                    user: 'Help with {{topic}}',
                }),
                inputs: { role: 'helpful', topic: 'testing' },
            });

            await AgentExecutor.execute(ctx);

            expect(mockExecute).toHaveBeenCalledWith(
                expect.objectContaining({
                    systemPrompt: 'You are helpful',
                    userPrompt: 'Help with testing',
                })
            );
        });

        it('should use last user message from chatContext when available', async () => {
            const mockExecute = vi.fn().mockResolvedValue({
                success: true,
                text: 'Response',
            });
            const mockModel = createMockModelPlugin({
                category: 'llm',
                execute: mockExecute,
            });
            mockModelRegistryGet.mockReturnValue(mockModel);

            const ctx = createMockContext({
                modelConfig: { modelId: 'gpt-4o', provider: 'openai' },
                asset: createMockAsset({
                    system: 'System prompt',
                    user: 'Default user prompt',
                }),
                chatContext: [
                    { role: 'user', content: 'First message' },
                    { role: 'assistant', content: 'First response' },
                    { role: 'user', content: 'Latest message' },
                ],
            });

            await AgentExecutor.execute(ctx);

            expect(mockExecute).toHaveBeenCalledWith(
                expect.objectContaining({
                    userPrompt: 'Latest message',
                })
            );
        });

        it('should interpolate prompt templates with input values', async () => {
            const mockExecute = vi.fn().mockResolvedValue({
                success: true,
                text: 'Response',
            });
            const mockModel = createMockModelPlugin({
                category: 'llm',
                execute: mockExecute,
            });
            mockModelRegistryGet.mockReturnValue(mockModel);

            const ctx = createMockContext({
                modelConfig: { modelId: 'gpt-4o', provider: 'openai' },
                asset: createMockAsset({
                    system: 'You are a {{type}} assistant',
                    user: 'Help me with {{topic}}',
                }),
                inputs: { type: 'coding', topic: 'TypeScript' },
            });

            await AgentExecutor.execute(ctx);

            expect(mockExecute).toHaveBeenCalledWith(
                expect.objectContaining({
                    systemPrompt: 'You are a coding assistant',
                    userPrompt: 'Help me with TypeScript',
                })
            );
        });

        it('should return model execution error', async () => {
            const mockExecute = vi.fn().mockResolvedValue({
                success: false,
                error: 'Rate limit exceeded',
            });
            const mockModel = createMockModelPlugin({
                category: 'llm',
                execute: mockExecute,
            });
            mockModelRegistryGet.mockReturnValue(mockModel);

            const ctx = createMockContext({
                modelConfig: { modelId: 'gpt-4o', provider: 'openai' },
                asset: createMockAsset(),
            });

            const result = await AgentExecutor.execute(ctx);

            expect(result).toEqual({
                success: false,
                error: 'Rate limit exceeded',
            });
        });
    });

    describe('execute - image generation', () => {
        it('should handle image generation results', async () => {
            const mockExecute = vi.fn().mockResolvedValue({
                success: true,
                images: [
                    { url: 'data:image/png;base64,abc123', width: 512, height: 512 },
                ],
            });
            const mockModel = createMockModelPlugin({
                category: 'image-generation',
                provider: 'openai',
                execute: mockExecute,
            });
            mockModelRegistryGet.mockReturnValue(mockModel);

            const ctx = createMockContext({
                modelConfig: { modelId: 'dall-e-3', provider: 'openai' },
                inputs: { prompt: 'A cat' },
                asset: createMockAsset({ user: '{{prompt}}' }),
            });

            const result = await AgentExecutor.execute(ctx);

            expect(result.success).toBe(true);
            expect(result.data).toEqual([
                expect.objectContaining({
                    mediaAssetId: 'asset-123',
                    starred: false,
                }),
            ]);
        });

        it('should handle data URL images', async () => {
            const mockExecute = vi.fn().mockResolvedValue({
                success: true,
                images: [
                    { url: 'data:image/png;base64,xyz789' },
                ],
            });
            const mockModel = createMockModelPlugin({
                category: 'image-generation',
                provider: 'fal',
                execute: mockExecute,
            });
            mockModelRegistryGet.mockReturnValue(mockModel);

            const ctx = createMockContext({
                modelConfig: { modelId: 'flux-pro', provider: 'fal' },
                asset: createMockAsset(),
            });

            const result = await AgentExecutor.execute(ctx);

            expect(result.success).toBe(true);
            expect(mockSaveProcessedImage).toHaveBeenCalledWith('data:image/png;base64,xyz789');
        });

        it('should download and save HTTP URL images', async () => {
            const mockExecute = vi.fn().mockResolvedValue({
                success: true,
                images: [
                    { url: 'https://example.com/generated.png' },
                ],
            });
            const mockModel = createMockModelPlugin({
                category: 'image-generation',
                provider: 'replicate',
                execute: mockExecute,
            });
            mockModelRegistryGet.mockReturnValue(mockModel);

            const ctx = createMockContext({
                modelConfig: { modelId: 'stable-diffusion', provider: 'replicate' },
                asset: createMockAsset(),
            });

            const result = await AgentExecutor.execute(ctx);

            expect(result.success).toBe(true);
            expect(mockDownloadAndSaveImage).toHaveBeenCalledWith('https://example.com/generated.png');
        });

        it('should fallback to URL for local paths', async () => {
            const mockExecute = vi.fn().mockResolvedValue({
                success: true,
                images: [
                    { url: '/local/path/to/image.png' },
                ],
            });
            const mockModel = createMockModelPlugin({
                category: 'image-generation',
                isLocal: true,
                provider: 'comfyui',
                execute: mockExecute,
            });
            mockModelRegistryGet.mockReturnValue(mockModel);

            const ctx = createMockContext({
                modelConfig: { modelId: 'local-sd', provider: 'comfyui' },
                asset: createMockAsset(),
                inputs: {}, // Empty inputs so caption will be empty
            });

            const result = await AgentExecutor.execute(ctx);

            expect(result.success).toBe(true);
            expect(result.data).toEqual([
                {
                    id: expect.stringMatching(/^gen-\d+-0$/),
                    src: '/local/path/to/image.png',
                    starred: false,
                    caption: '',
                },
            ]);
        });

        it('should handle image save errors gracefully', async () => {
            const mockExecute = vi.fn().mockResolvedValue({
                success: true,
                images: [
                    { url: 'data:image/png;base64,error' },
                ],
            });
            const mockModel = createMockModelPlugin({
                category: 'image-generation',
                execute: mockExecute,
            });
            mockModelRegistryGet.mockReturnValue(mockModel);
            mockSaveProcessedImage.mockRejectedValue(new Error('Save failed'));

            const ctx = createMockContext({
                modelConfig: { modelId: 'dall-e-3', provider: 'openai' },
                inputs: { prompt: 'Error image' },
                asset: createMockAsset(),
            });

            const result = await AgentExecutor.execute(ctx);

            expect(result.success).toBe(true);
            expect(result.data).toEqual([
                expect.objectContaining({
                    src: 'data:image/png;base64,error',
                }),
            ]);
        });

        it('should handle multiple generated images', async () => {
            const mockExecute = vi.fn().mockResolvedValue({
                success: true,
                images: [
                    { url: 'data:image/png;base64,img1' },
                    { url: 'data:image/png;base64,img2' },
                    { url: 'data:image/png;base64,img3' },
                ],
            });
            const mockModel = createMockModelPlugin({
                category: 'image-generation',
                execute: mockExecute,
            });
            mockModelRegistryGet.mockReturnValue(mockModel);
            mockSaveProcessedImage
                .mockResolvedValueOnce({ assetId: 'asset-1', relativePath: '1.png', thumbnailPath: null, width: 512, height: 512 })
                .mockResolvedValueOnce({ assetId: 'asset-2', relativePath: '2.png', thumbnailPath: null, width: 512, height: 512 })
                .mockResolvedValueOnce({ assetId: 'asset-3', relativePath: '3.png', thumbnailPath: null, width: 512, height: 512 });

            const ctx = createMockContext({
                modelConfig: { modelId: 'dall-e-3', provider: 'openai' },
                asset: createMockAsset(),
            });

            const result = await AgentExecutor.execute(ctx);

            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(3);
            expect(result.data).toEqual([
                expect.objectContaining({ mediaAssetId: 'asset-1' }),
                expect.objectContaining({ mediaAssetId: 'asset-2' }),
                expect.objectContaining({ mediaAssetId: 'asset-3' }),
            ]);
        });

        it('should use prompt as caption for generated images', async () => {
            const mockExecute = vi.fn().mockResolvedValue({
                success: true,
                images: [
                    { url: 'data:image/png;base64,cat' },
                ],
            });
            const mockModel = createMockModelPlugin({
                category: 'image-generation',
                execute: mockExecute,
            });
            mockModelRegistryGet.mockReturnValue(mockModel);

            const ctx = createMockContext({
                modelConfig: { modelId: 'dall-e-3', provider: 'openai' },
                inputs: { prompt: 'A cute cat playing with yarn' },
                asset: createMockAsset(),
            });

            const result = await AgentExecutor.execute(ctx);

            expect(result.success).toBe(true);
            expect(result.data?.[0]).toEqual(
                expect.objectContaining({
                    caption: 'A cute cat playing with yarn',
                })
            );
        });
    });

    describe('execute - video generation', () => {
        it('should handle video generation results', async () => {
            const mockExecute = vi.fn().mockResolvedValue({
                success: true,
                videoUrl: 'https://example.com/video.mp4',
            });
            const mockModel = createMockModelPlugin({
                category: 'video-generation',
                provider: 'replicate',
                execute: mockExecute,
            });
            mockModelRegistryGet.mockReturnValue(mockModel);

            const ctx = createMockContext({
                modelConfig: { modelId: 'video-model', provider: 'replicate' },
                asset: createMockAsset(),
            });

            const result = await AgentExecutor.execute(ctx);

            expect(result.success).toBe(true);
            expect(result.data).toEqual({
                videoUrl: 'https://example.com/video.mp4',
            });
        });
    });

    describe('execute - media input preparation', () => {
        it('should handle vision input from model:visionImage port (gallery array)', async () => {
            const mockExecute = vi.fn().mockResolvedValue({
                success: true,
                images: [{ url: 'data:image/png;base64,result' }],
            });
            const mockModel = createMockModelPlugin({
                category: 'image-generation',
                execute: mockExecute,
            });
            mockModelRegistryGet.mockReturnValue(mockModel);

            const ctx = createMockContext({
                modelConfig: { modelId: 'img2img', provider: 'openai' },
                inputs: {
                    'model:visionImage': [
                        { src: 'https://example.com/source.png', id: 'img1' },
                        { src: 'https://example.com/source2.png', id: 'img2' },
                    ],
                    prompt: 'Transform this',
                },
                asset: createMockAsset(),
            });

            await AgentExecutor.execute(ctx);

            expect(mockExecute).toHaveBeenCalledWith(
                expect.objectContaining({
                    images: ['https://example.com/source.png', 'https://example.com/source2.png'],
                })
            );
        });

        it('should handle vision input wrapped in PortValue', async () => {
            const mockExecute = vi.fn().mockResolvedValue({
                success: true,
                images: [{ url: 'data:image/png;base64,result' }],
            });
            const mockModel = createMockModelPlugin({
                category: 'image-generation',
                execute: mockExecute,
            });
            mockModelRegistryGet.mockReturnValue(mockModel);

            const ctx = createMockContext({
                modelConfig: { modelId: 'img2img', provider: 'openai' },
                inputs: {
                    'model:visionImage': {
                        value: [{ src: 'https://example.com/port-value.png' }],
                        type: 'gallery',
                    },
                    prompt: 'Transform',
                },
                asset: createMockAsset(),
            });

            await AgentExecutor.execute(ctx);

            expect(mockExecute).toHaveBeenCalledWith(
                expect.objectContaining({
                    images: ['https://example.com/port-value.png'],
                })
            );
        });

        it('should handle string vision input', async () => {
            const mockExecute = vi.fn().mockResolvedValue({
                success: true,
                images: [{ url: 'data:image/png;base64,result' }],
            });
            const mockModel = createMockModelPlugin({
                category: 'image-generation',
                execute: mockExecute,
            });
            mockModelRegistryGet.mockReturnValue(mockModel);

            const ctx = createMockContext({
                modelConfig: { modelId: 'img2img', provider: 'openai' },
                inputs: {
                    'model:visionImage': 'https://example.com/string-image.png',
                    prompt: 'Transform',
                },
                asset: createMockAsset(),
            });

            await AgentExecutor.execute(ctx);

            expect(mockExecute).toHaveBeenCalledWith(
                expect.objectContaining({
                    images: ['https://example.com/string-image.png'],
                })
            );
        });

        it('should handle object with src property', async () => {
            const mockExecute = vi.fn().mockResolvedValue({
                success: true,
                images: [{ url: 'data:image/png;base64,result' }],
            });
            const mockModel = createMockModelPlugin({
                category: 'image-generation',
                execute: mockExecute,
            });
            mockModelRegistryGet.mockReturnValue(mockModel);

            const ctx = createMockContext({
                modelConfig: { modelId: 'img2img', provider: 'openai' },
                inputs: {
                    'model:visionImage': { src: 'https://example.com/object.png' },
                    prompt: 'Transform',
                },
                asset: createMockAsset(),
            });

            await AgentExecutor.execute(ctx);

            expect(mockExecute).toHaveBeenCalledWith(
                expect.objectContaining({
                    images: ['https://example.com/object.png'],
                })
            );
        });

        it('should handle legacy direct image input', async () => {
            const mockExecute = vi.fn().mockResolvedValue({
                success: true,
                images: [{ url: 'data:image/png;base64,result' }],
            });
            const mockModel = createMockModelPlugin({
                category: 'image-generation',
                execute: mockExecute,
            });
            mockModelRegistryGet.mockReturnValue(mockModel);

            const ctx = createMockContext({
                modelConfig: { modelId: 'img2img', provider: 'openai' },
                inputs: {
                    image: 'https://example.com/legacy.png',
                    prompt: 'Transform',
                },
                asset: createMockAsset(),
            });

            await AgentExecutor.execute(ctx);

            expect(mockExecute).toHaveBeenCalledWith(
                expect.objectContaining({
                    images: ['https://example.com/legacy.png'],
                })
            );
        });

        it('should prefer model:visionImage over direct image input', async () => {
            const mockExecute = vi.fn().mockResolvedValue({
                success: true,
                images: [{ url: 'data:image/png;base64,result' }],
            });
            const mockModel = createMockModelPlugin({
                category: 'image-generation',
                execute: mockExecute,
            });
            mockModelRegistryGet.mockReturnValue(mockModel);

            const ctx = createMockContext({
                modelConfig: { modelId: 'img2img', provider: 'openai' },
                inputs: {
                    'model:visionImage': 'https://example.com/vision-port.png',
                    image: 'https://example.com/direct.png',
                    prompt: 'Transform',
                },
                asset: createMockAsset(),
            });

            await AgentExecutor.execute(ctx);

            expect(mockExecute).toHaveBeenCalledWith(
                expect.objectContaining({
                    images: ['https://example.com/vision-port.png'],
                })
            );
        });

        it('should include negative prompt in media input', async () => {
            const mockExecute = vi.fn().mockResolvedValue({
                success: true,
                images: [{ url: 'data:image/png;base64,result' }],
            });
            const mockModel = createMockModelPlugin({
                category: 'image-generation',
                execute: mockExecute,
            });
            mockModelRegistryGet.mockReturnValue(mockModel);

            const ctx = createMockContext({
                modelConfig: { modelId: 'dall-e-3', provider: 'openai' },
                inputs: {
                    prompt: 'A cat',
                    negativePrompt: 'blurry, low quality',
                },
                asset: createMockAsset(),
            });

            await AgentExecutor.execute(ctx);

            expect(mockExecute).toHaveBeenCalledWith(
                expect.objectContaining({
                    negativePrompt: 'blurry, low quality',
                })
            );
        });
    });

    describe('execute - error handling', () => {
        it('should catch and return execution errors', async () => {
            const mockExecute = vi.fn().mockRejectedValue(new Error('Network error'));
            const mockModel = createMockModelPlugin({
                category: 'llm',
                execute: mockExecute,
            });
            mockModelRegistryGet.mockReturnValue(mockModel);

            const ctx = createMockContext({
                modelConfig: { modelId: 'gpt-4o', provider: 'openai' },
                asset: createMockAsset(),
            });

            const result = await AgentExecutor.execute(ctx);

            expect(result).toEqual({
                success: false,
                error: 'Network error',
            });
        });

        it('should handle errors without message property', async () => {
            const mockExecute = vi.fn().mockRejectedValue('String error');
            const mockModel = createMockModelPlugin({
                category: 'llm',
                execute: mockExecute,
            });
            mockModelRegistryGet.mockReturnValue(mockModel);

            const ctx = createMockContext({
                modelConfig: { modelId: 'gpt-4o', provider: 'openai' },
                asset: createMockAsset(),
            });

            const result = await AgentExecutor.execute(ctx);

            expect(result).toEqual({
                success: false,
                error: 'Execution failed',
            });
        });

        it('should handle errors without message property', async () => {
            const mockExecute = vi.fn().mockRejectedValue({ customError: 'Something went wrong' });
            const mockModel = createMockModelPlugin({
                category: 'llm',
                provider: 'openai',
                execute: mockExecute,
            });
            mockModelRegistryGet.mockReturnValue(mockModel);
            mockGetProviderCredentials.mockClear();
            mockGetProviderCredentials.mockReturnValue({ apiKey: 'test-api-key' });

            const ctx = createMockContext({
                modelConfig: { modelId: 'gpt-4o', provider: 'openai' },
                asset: createMockAsset(),
                manifest: {
                    version: 1,
                    id: 'test',
                    name: 'Test',
                    executor: {
                        type: 'agent',
                        model: { category: 'llm' },
                    },
                    output: { node: 'text' },
                },
            });

            const result = await AgentExecutor.execute(ctx);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Execution failed');
        });
    });

    describe('execute - credentials handling', () => {
        it('should use credentials from modelConfig provider', async () => {
            const mockExecute = vi.fn().mockResolvedValue({
                success: true,
                text: 'Response',
            });
            const mockModel = createMockModelPlugin({
                category: 'llm',
                provider: 'openai',
                execute: mockExecute,
            });
            mockModelRegistryGet.mockReturnValue(mockModel);
            mockGetProviderCredentials.mockReturnValue({
                apiKey: 'sk-test-key',
                baseUrl: 'https://custom.openai.com',
            });

            const ctx = createMockContext({
                modelConfig: {
                    modelId: 'gpt-4o',
                    provider: 'openai',
                },
                asset: createMockAsset(),
            });

            await AgentExecutor.execute(ctx);

            expect(mockExecute).toHaveBeenCalledWith(
                expect.objectContaining({
                    credentials: {
                        apiKey: 'sk-test-key',
                        baseUrl: 'https://custom.openai.com',
                    },
                })
            );
        });

        it('should fallback to model plugin provider when not in modelConfig', async () => {
            const mockExecute = vi.fn().mockResolvedValue({
                success: true,
                text: 'Response',
            });
            const mockModel = createMockModelPlugin({
                category: 'llm',
                provider: 'anthropic',
                execute: mockExecute,
            });
            mockModelRegistryGet.mockReturnValue(mockModel);
            mockGetProviderCredentials.mockReturnValue({
                apiKey: 'sk-ant-key',
            });

            const ctx = createMockContext({
                modelConfig: {
                    modelId: 'claude-3-opus',
                },
                asset: createMockAsset(),
            });

            await AgentExecutor.execute(ctx);

            expect(mockExecute).toHaveBeenCalledWith(
                expect.objectContaining({
                    credentials: expect.objectContaining({
                        apiKey: 'sk-ant-key',
                    }),
                })
            );
        });

        it('should pass provider for multi-provider models', async () => {
            const mockExecute = vi.fn().mockResolvedValue({
                success: true,
                images: [{ url: 'data:image/png;base64,test' }],
            });
            const mockModel = createMockModelPlugin({
                category: 'image-generation',
                provider: 'fal',
                supportedProviders: ['fal', 'replicate'],
                execute: mockExecute,
            });
            mockModelRegistryGet.mockReturnValue(mockModel);

            const ctx = createMockContext({
                modelConfig: {
                    modelId: 'flux-pro',
                    provider: 'replicate',
                },
                asset: createMockAsset(),
            });

            await AgentExecutor.execute(ctx);

            expect(mockExecute).toHaveBeenCalledWith(
                expect.objectContaining({
                    provider: 'replicate',
                })
            );
        });
    });
});
