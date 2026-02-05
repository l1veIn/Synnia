/**
 * Recipe Loader Tests
 * Tests for createRecipeFromManifest and getIcon functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRecipeFromManifest } from '../recipeLoader';
import type { RecipeManifest, ExecutionContext } from '@/domain/recipe/manifest';
import type { FieldDefinition } from '@/domain/asset/types';
import type { SynniaNode } from '@/presentation/types/project';
import { Executor } from '@/infrastructure/executors';
import { ExecutionResult } from '@/domain/recipe/manifest';

// Mock lucide-react - need to handle dynamic property access for icons
vi.mock('lucide-react', () => {
    const mockIconFunction = () => null;
    return {
        LucideIcon: mockIconFunction,
        // Add a few known icons that we can test with
        Search: mockIconFunction,
        Settings: mockIconFunction,
        User: mockIconFunction,
    };
});

// Mock the executors module
vi.mock('@features/executors', () => ({
    getExecutorForManifest: vi.fn(),
}));

// Import the mocked function
import { getExecutorForManifest } from '@/infrastructure/executors';

describe('recipeLoader', () => {
    // Create mock executor
    const mockExecutor: Executor = {
        type: 'agent',
        canHandle: vi.fn(() => true),
        execute: vi.fn(async () => ({ success: true, data: { result: 'test' } })),
    };

    // Helper to create a mock ExecutionContext
    const createMockContext = (manifest: RecipeManifest): ExecutionContext => ({
        inputs: {},
        nodeId: 'node-1',
        engine: {} as ExecutionContext['engine'],
        node: {} as SynniaNode,
        manifest,
    });

    beforeEach(() => {
        vi.clearAllMocks();
        // Setup default mock return
        vi.mocked(getExecutorForManifest).mockReturnValue(mockExecutor);
    });

    // ============================================================================
    // getIcon (internal function - tested via createRecipeFromManifest)
    // ============================================================================

    describe('getIcon (via createRecipeFromManifest)', () => {
        it('should return undefined when icon is not provided', () => {
            const manifest: RecipeManifest = {
                version: 1,
                id: 'test-recipe',
                name: 'Test Recipe',
                executor: { type: 'agent', model: { category: 'llm' } },
                output: { node: 'form' },
            };

            const recipe = createRecipeFromManifest(manifest);

            expect(recipe.icon).toBeUndefined();
        });

        it('should return a function for valid icon name', () => {
            const manifest: RecipeManifest = {
                version: 1,
                id: 'test-recipe',
                name: 'Test Recipe',
                icon: 'Search',
                executor: { type: 'agent', model: { category: 'llm' } },
                output: { node: 'form' },
            };

            const recipe = createRecipeFromManifest(manifest);

            // The icon should be a function (the mock icon function)
            expect(typeof recipe.icon).toBe('function');
        });

        it('should return undefined for empty string icon', () => {
            const manifest: RecipeManifest = {
                version: 1,
                id: 'test-recipe',
                name: 'Test Recipe',
                icon: '',
                executor: { type: 'agent', model: { category: 'llm' } },
                output: { node: 'form' },
            };

            const recipe = createRecipeFromManifest(manifest);

            expect(recipe.icon).toBeUndefined();
        });
    });

    // ============================================================================
    // createRecipeFromManifest
    // ============================================================================

    describe('createRecipeFromManifest', () => {
        const baseManifest: RecipeManifest = {
            version: 1,
            id: 'test-recipe',
            name: 'Test Recipe',
            description: 'A test recipe',
            category: 'test',
            executor: { type: 'agent', model: { category: 'llm' } },
            output: { node: 'form' },
        };

        it('should create a RecipeDefinition with all required fields', () => {
            const recipe = createRecipeFromManifest(baseManifest);

            expect(recipe.id).toBe('test-recipe');
            expect(recipe.name).toBe('Test Recipe');
            expect(recipe.description).toBe('A test recipe');
            expect(recipe.category).toBe('test');
            expect(recipe.manifest).toBe(baseManifest);
            expect(recipe.inputSchema).toEqual([]);
            expect(typeof recipe.execute).toBe('function');
        });

        it('should extract inputSchema from legacy format (array directly)', () => {
            const inputSchema: FieldDefinition[] = [
                { key: 'name', type: 'string', label: 'Name' },
                { key: 'age', type: 'number', label: 'Age' },
            ];

            const manifest: RecipeManifest = {
                ...baseManifest,
                input: inputSchema,
            };

            const recipe = createRecipeFromManifest(manifest);

            expect(recipe.inputSchema).toEqual(inputSchema);
            expect(recipe.inputSchema).toHaveLength(2);
            expect(recipe.inputSchema[0].key).toBe('name');
        });

        it('should extract inputSchema from V1.0 format (nested schema)', () => {
            const inputSchema: FieldDefinition[] = [
                { key: 'email', type: 'string', label: 'Email' },
            ];

            const manifest: RecipeManifest = {
                ...baseManifest,
                input: { schema: inputSchema },
            };

            const recipe = createRecipeFromManifest(manifest);

            expect(recipe.inputSchema).toEqual(inputSchema);
            expect(recipe.inputSchema).toHaveLength(1);
            expect(recipe.inputSchema[0].key).toBe('email');
        });

        it('should default to empty array when input is not provided', () => {
            const manifest: RecipeManifest = {
                ...baseManifest,
                input: undefined,
            };

            const recipe = createRecipeFromManifest(manifest);

            expect(recipe.inputSchema).toEqual([]);
        });

        it('should default to empty array when input is not an array or object with schema', () => {
            const manifest: RecipeManifest = {
                ...baseManifest,
                input: 'invalid' as unknown as FieldDefinition[],
            };

            const recipe = createRecipeFromManifest(manifest);

            expect(recipe.inputSchema).toEqual([]);
        });

        it('should handle empty input array', () => {
            const manifest: RecipeManifest = {
                ...baseManifest,
                input: [],
            };

            const recipe = createRecipeFromManifest(manifest);

            expect(recipe.inputSchema).toEqual([]);
        });

        it('should handle empty nested schema', () => {
            const manifest: RecipeManifest = {
                ...baseManifest,
                input: { schema: [] },
            };

            const recipe = createRecipeFromManifest(manifest);

            expect(recipe.inputSchema).toEqual([]);
        });

        // ============================================================================
        // Executor Creation
        // ============================================================================

        it('should create an executor function', () => {
            const recipe = createRecipeFromManifest(baseManifest);

            expect(typeof recipe.execute).toBe('function');
        });

        it('should call getExecutorForManifest when execute is called', async () => {
            const mockResult: ExecutionResult = { success: true, data: { result: 'success' } };
            mockExecutor.execute = vi.fn(async () => mockResult);

            const recipe = createRecipeFromManifest(baseManifest);

            const mockContext = createMockContext(baseManifest);
            mockContext.inputs = { test: 'value' };

            const result = await recipe.execute(mockContext);

            expect(getExecutorForManifest).toHaveBeenCalledWith(baseManifest);
            expect(result).toEqual(mockResult);
        });

        it('should return error result when no executor is found', async () => {
            vi.mocked(getExecutorForManifest).mockReturnValue(undefined);

            const recipe = createRecipeFromManifest(baseManifest);

            const mockContext = createMockContext(baseManifest);

            const result = await recipe.execute(mockContext);

            expect(result).toEqual({
                success: false,
                error: 'No executor found for recipe type',
            });
        });

        it('should pass through execution result from executor', async () => {
            const expectedResults: ExecutionResult[] = [
                { success: true, data: { output: 'value' } },
                { success: false, error: 'Something went wrong' },
                { success: true, data: { items: [] } },
            ];

            for (const expected of expectedResults) {
                mockExecutor.execute = vi.fn(async () => expected);

                const recipe = createRecipeFromManifest(baseManifest);

                const mockContext = createMockContext(baseManifest);

                const result = await recipe.execute(mockContext);

                expect(result).toEqual(expected);
            }
        });

        // ============================================================================
        // Different Executor Types
        // ============================================================================

        it('should work with http executor type', async () => {
            const httpManifest: RecipeManifest = {
                ...baseManifest,
                executor: { type: 'http', endpoint: 'https://api.example.com' },
            };

            const httpExecutor: Executor = {
                type: 'http',
                canHandle: vi.fn(() => true),
                execute: vi.fn(async () => ({ success: true, data: { status: 'ok' } })),
            };

            vi.mocked(getExecutorForManifest).mockReturnValue(httpExecutor);

            const recipe = createRecipeFromManifest(httpManifest);

            const mockContext = createMockContext(httpManifest);

            await recipe.execute(mockContext);

            expect(getExecutorForManifest).toHaveBeenCalledWith(httpManifest);
            expect(httpExecutor.execute).toHaveBeenCalledWith(mockContext);
        });

        it('should work with agent executor type', async () => {
            const agentManifest: RecipeManifest = {
                ...baseManifest,
                executor: {
                    type: 'agent',
                    model: {
                        category: 'llm',
                        capabilities: ['chat'],
                    },
                },
            };

            const agentExecutor: Executor = {
                type: 'agent',
                canHandle: vi.fn(() => true),
                execute: vi.fn(async () => ({ success: true, data: { response: 'hello' } })),
            };

            vi.mocked(getExecutorForManifest).mockReturnValue(agentExecutor);

            const recipe = createRecipeFromManifest(agentManifest);

            const mockContext = createMockContext(agentManifest);

            await recipe.execute(mockContext);

            expect(getExecutorForManifest).toHaveBeenCalledWith(agentManifest);
            expect(agentExecutor.execute).toHaveBeenCalledWith(mockContext);
        });

        // ============================================================================
        // Edge Cases
        // ============================================================================

        it('should handle manifest without optional fields', () => {
            const minimalManifest: RecipeManifest = {
                version: 1,
                id: 'minimal-recipe',
                name: 'Minimal Recipe',
                executor: { type: 'agent', model: { category: 'llm' } },
                output: { node: 'text' },
            };

            const recipe = createRecipeFromManifest(minimalManifest);

            expect(recipe.id).toBe('minimal-recipe');
            expect(recipe.name).toBe('Minimal Recipe');
            expect(recipe.description).toBeUndefined();
            expect(recipe.category).toBeUndefined();
            expect(recipe.icon).toBeUndefined();
        });

        it('should handle complex input schema with nested fields', () => {
            const complexSchema: FieldDefinition[] = [
                {
                    key: 'address',
                    type: 'object',
                    label: 'Address',
                    schema: [
                        { key: 'street', type: 'string' },
                        { key: 'city', type: 'string' },
                    ],
                },
                {
                    key: 'tags',
                    type: 'array',
                    schema: [{ key: 'name', type: 'string' }],
                },
            ];

            const manifest: RecipeManifest = {
                ...baseManifest,
                input: complexSchema,
            };

            const recipe = createRecipeFromManifest(manifest);

            expect(recipe.inputSchema).toEqual(complexSchema);
            expect(recipe.inputSchema[0].schema).toHaveLength(2);
            expect(recipe.inputSchema[1].schema).toHaveLength(1);
        });

        it('should handle manifest with empty string description', () => {
            const manifest: RecipeManifest = {
                ...baseManifest,
                description: '',
            };

            const recipe = createRecipeFromManifest(manifest);

            expect(recipe.description).toBe('');
        });

        it('should handle manifest with empty string category', () => {
            const manifest: RecipeManifest = {
                ...baseManifest,
                category: '',
            };

            const recipe = createRecipeFromManifest(manifest);

            expect(recipe.category).toBe('');
        });
    });
});
