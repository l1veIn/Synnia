// @ts-nocheck
// Http Executor Tests
// Tests for HTTP request execution with template variable support

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpExecutor } from '../HttpExecutor';
import { ExecutionContext, RecipeManifest } from '@/domain/recipe/manifest';

// ============================================================================
// Mocks
// ============================================================================

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ============================================================================
// Test Helpers
// ============================================================================

function createMockContext(
    overrides?: Partial<ExecutionContext>
): ExecutionContext {
    const manifest: RecipeManifest = {
        version: 1,
        id: 'test-recipe',
        name: 'Test Recipe',
        executor: {
            type: 'http',
            endpoint: 'https://api.example.com/test',
        },
        output: { node: 'text' },
    };

    return {
        manifest,
        inputs: {},
        nodeId: 'node-1',
        engine: {} as never,
        node: {} as never,
        ...overrides,
    };
}

// ============================================================================
// Tests
// ============================================================================

describe('HttpExecutor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('canHandle', () => {
        it('should return true for http executor type', () => {
            const manifest: RecipeManifest = {
                version: 1,
                id: 'test',
                name: 'Test',
                executor: { type: 'http', endpoint: 'https://api.example.com' },
                output: { node: 'text' },
            };

            expect(HttpExecutor.canHandle(manifest)).toBe(true);
        });

        it('should return false for agent executor type', () => {
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

            expect(HttpExecutor.canHandle(manifest)).toBe(false);
        });

        it('should return false when executor is undefined', () => {
            const manifest: RecipeManifest = {
                version: 1,
                id: 'test',
                name: 'Test',
                executor: undefined as never,
                output: { node: 'text' },
            };

            expect(HttpExecutor.canHandle(manifest)).toBe(false);
        });
    });

    describe('execute', () => {
        describe('config validation', () => {
            it('should return error when url/endpoint is missing', async () => {
                const ctx = createMockContext({
                    manifest: {
                        version: 1,
                        id: 'test',
                        name: 'Test',
                        executor: { type: 'http' },
                        output: { node: 'text' },
                    },
                });

                const result = await HttpExecutor.execute(ctx);

                expect(result).toEqual({
                    success: false,
                    error: 'HTTP executor requires url or endpoint in config',
                });
                expect(mockFetch).not.toHaveBeenCalled();
            });
        });

        describe('request building', () => {
            it('should use POST method by default', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ result: 'success' }),
                });

                const ctx = createMockContext();

                await HttpExecutor.execute(ctx);

                expect(mockFetch).toHaveBeenCalledWith(
                    'https://api.example.com/test',
                    expect.objectContaining({
                        method: 'POST',
                    })
                );
            });

            it('should use configured method', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ result: 'success' }),
                });

                const ctx = createMockContext({
                    manifest: {
                        version: 1,
                        id: 'test',
                        name: 'Test',
                        executor: {
                            type: 'http',
                            endpoint: 'https://api.example.com/test',
                            method: 'GET',
                        },
                        output: { node: 'text' },
                    },
                });

                await HttpExecutor.execute(ctx);

                expect(mockFetch).toHaveBeenCalledWith(
                    'https://api.example.com/test',
                    expect.objectContaining({
                        method: 'GET',
                    })
                );
            });

            it('should use url field when endpoint is not present', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ result: 'success' }),
                });

                const ctx = createMockContext({
                    manifest: {
                        version: 1,
                        id: 'test',
                        name: 'Test',
                        executor: {
                            type: 'http',
                            url: 'https://api.example.com/custom',
                        },
                        output: { node: 'text' },
                    },
                });

                await HttpExecutor.execute(ctx);

                expect(mockFetch).toHaveBeenCalledWith(
                    'https://api.example.com/custom',
                    expect.any(Object)
                );
            });

            it('should prefer url over endpoint when both are present', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ result: 'success' }),
                });

                const ctx = createMockContext({
                    manifest: {
                        version: 1,
                        id: 'test',
                        name: 'Test',
                        executor: {
                            type: 'http',
                            url: 'https://api.example.com/from-url',
                            endpoint: 'https://api.example.com/from-endpoint',
                        },
                        output: { node: 'text' },
                    },
                });

                await HttpExecutor.execute(ctx);

                expect(mockFetch).toHaveBeenCalledWith(
                    'https://api.example.com/from-url',
                    expect.any(Object)
                );
            });

            it('should include custom headers', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ result: 'success' }),
                });

                const ctx = createMockContext({
                    manifest: {
                        version: 1,
                        id: 'test',
                        name: 'Test',
                        executor: {
                            type: 'http',
                            endpoint: 'https://api.example.com/test',
                            headers: {
                                'X-API-Key': 'test-key',
                                'X-Custom-Header': 'custom-value',
                            },
                        },
                        output: { node: 'text' },
                    },
                });

                await HttpExecutor.execute(ctx);

                expect(mockFetch).toHaveBeenCalledWith(
                    'https://api.example.com/test',
                    expect.objectContaining({
                        headers: expect.objectContaining({
                            'X-API-Key': 'test-key',
                            'X-Custom-Header': 'custom-value',
                        }),
                    })
                );
            });
        });

        describe('template interpolation', () => {
            it('should interpolate {{input.xxx}} syntax in URL', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ result: 'success' }),
                });

                const ctx = createMockContext({
                    manifest: {
                        version: 1,
                        id: 'test',
                        name: 'Test',
                        executor: {
                            type: 'http',
                            endpoint: 'https://api.example.com/users/{{userId}}',
                        },
                        output: { node: 'text' },
                    },
                    inputs: { userId: '12345' },
                });

                await HttpExecutor.execute(ctx);

                expect(mockFetch).toHaveBeenCalledWith(
                    'https://api.example.com/users/12345',
                    expect.any(Object)
                );
            });

            it('should interpolate {{xxx}} shorthand syntax in URL', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ result: 'success' }),
                });

                const ctx = createMockContext({
                    manifest: {
                        version: 1,
                        id: 'test',
                        name: 'Test',
                        executor: {
                            type: 'http',
                            endpoint: 'https://api.example.com/items/{{itemId}}',
                        },
                        output: { node: 'text' },
                    },
                    inputs: { itemId: 'abc' },
                });

                await HttpExecutor.execute(ctx);

                expect(mockFetch).toHaveBeenCalledWith(
                    'https://api.example.com/items/abc',
                    expect.any(Object)
                );
            });

            it('should interpolate template values in headers', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ result: 'success' }),
                });

                const ctx = createMockContext({
                    manifest: {
                        version: 1,
                        id: 'test',
                        name: 'Test',
                        executor: {
                            type: 'http',
                            endpoint: 'https://api.example.com/test',
                            headers: {
                                'Authorization': 'Bearer {{token}}',
                            },
                        },
                        output: { node: 'text' },
                    },
                    inputs: { token: 'my-secret-token' },
                });

                await HttpExecutor.execute(ctx);

                expect(mockFetch).toHaveBeenCalledWith(
                    'https://api.example.com/test',
                    expect.objectContaining({
                        headers: expect.objectContaining({
                            'Authorization': 'Bearer my-secret-token',
                        }),
                    })
                );
            });

            it('should interpolate template values in string body', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ result: 'success' }),
                });

                const ctx = createMockContext({
                    manifest: {
                        version: 1,
                        id: 'test',
                        name: 'Test',
                        executor: {
                            type: 'http',
                            endpoint: 'https://api.example.com/test',
                            body: '{"message": "{{message}}", "user": "{{user}}"}',
                        },
                        output: { node: 'text' },
                    },
                    inputs: { message: 'hello', user: 'alice' },
                });

                await HttpExecutor.execute(ctx);

                expect(mockFetch).toHaveBeenCalledWith(
                    'https://api.example.com/test',
                    expect.objectContaining({
                        body: '{"message": "hello", "user": "alice"}',
                    })
                );
            });

            it('should interpolate template values in object body', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ result: 'success' }),
                });

                const ctx = createMockContext({
                    manifest: {
                        version: 1,
                        id: 'test',
                        name: 'Test',
                        executor: {
                            type: 'http',
                            endpoint: 'https://api.example.com/test',
                            body: {
                                query: '{{searchQuery}}',
                                limit: 10,
                            },
                        },
                        output: { node: 'text' },
                    },
                    inputs: { searchQuery: 'test search' },
                });

                await HttpExecutor.execute(ctx);

                const callArgs = mockFetch.mock.calls[0];
                const body = JSON.parse(callArgs[1].body);

                expect(body).toEqual({
                    query: 'test search',
                    limit: 10,
                });
            });

            it('should handle object values in interpolation (JSON stringify)', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ result: 'success' }),
                });

                const ctx = createMockContext({
                    manifest: {
                        version: 1,
                        id: 'test',
                        name: 'Test',
                        executor: {
                            type: 'http',
                            endpoint: 'https://api.example.com/test',
                            body: 'data={{data}}',
                        },
                        output: { node: 'text' },
                    },
                    inputs: { data: { nested: { value: 42 } } },
                });

                await HttpExecutor.execute(ctx);

                expect(mockFetch).toHaveBeenCalledWith(
                    'https://api.example.com/test',
                    expect.objectContaining({
                        body: 'data={"nested":{"value":42}}',
                    })
                );
            });

            it('should return empty string for undefined template variables', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ result: 'success' }),
                });

                const ctx = createMockContext({
                    manifest: {
                        version: 1,
                        id: 'test',
                        name: 'Test',
                        executor: {
                            type: 'http',
                            endpoint: 'https://api.example.com/{{missing}}/test',
                        },
                        output: { node: 'text' },
                    },
                    inputs: {},
                });

                await HttpExecutor.execute(ctx);

                expect(mockFetch).toHaveBeenCalledWith(
                    'https://api.example.com//test',
                    expect.any(Object)
                );
            });
        });

        describe('request body handling', () => {
            it('should not include body for GET requests', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ result: 'success' }),
                });

                const ctx = createMockContext({
                    manifest: {
                        version: 1,
                        id: 'test',
                        name: 'Test',
                        executor: {
                            type: 'http',
                            endpoint: 'https://api.example.com/test',
                            method: 'GET',
                            body: '{"test": "value"}',
                        },
                        output: { node: 'text' },
                    },
                });

                await HttpExecutor.execute(ctx);

                expect(mockFetch).toHaveBeenCalledWith(
                    'https://api.example.com/test',
                    expect.objectContaining({
                        body: undefined,
                    })
                );
            });

            it('should include body for POST requests', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ result: 'success' }),
                });

                const ctx = createMockContext({
                    manifest: {
                        version: 1,
                        id: 'test',
                        name: 'Test',
                        executor: {
                            type: 'http',
                            endpoint: 'https://api.example.com/test',
                            method: 'POST',
                            body: '{"test": "value"}',
                        },
                        output: { node: 'text' },
                    },
                });

                await HttpExecutor.execute(ctx);

                expect(mockFetch).toHaveBeenCalledWith(
                    'https://api.example.com/test',
                    expect.objectContaining({
                        body: '{"test": "value"}',
                    })
                );
            });

            it('should include body for PUT requests', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ result: 'success' }),
                });

                const ctx = createMockContext({
                    manifest: {
                        version: 1,
                        id: 'test',
                        name: 'Test',
                        executor: {
                            type: 'http',
                            endpoint: 'https://api.example.com/test',
                            method: 'PUT',
                            body: '{"updated": true}',
                        },
                        output: { node: 'text' },
                    },
                });

                await HttpExecutor.execute(ctx);

                expect(mockFetch).toHaveBeenCalledWith(
                    'https://api.example.com/test',
                    expect.objectContaining({
                        body: '{"updated": true}',
                    })
                );
            });

            it('should include body for PATCH requests', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ result: 'success' }),
                });

                const ctx = createMockContext({
                    manifest: {
                        version: 1,
                        id: 'test',
                        name: 'Test',
                        executor: {
                            type: 'http',
                            endpoint: 'https://api.example.com/test',
                            method: 'PATCH',
                            body: '{"patched": true}',
                        },
                        output: { node: 'text' },
                    },
                });

                await HttpExecutor.execute(ctx);

                expect(mockFetch).toHaveBeenCalledWith(
                    'https://api.example.com/test',
                    expect.objectContaining({
                        body: '{"patched": true}',
                    })
                );
            });

            it('should include body for DELETE requests', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ result: 'success' }),
                });

                const ctx = createMockContext({
                    manifest: {
                        version: 1,
                        id: 'test',
                        name: 'Test',
                        executor: {
                            type: 'http',
                            endpoint: 'https://api.example.com/test',
                            method: 'DELETE',
                            body: '{"force": true}',
                        },
                        output: { node: 'text' },
                    },
                });

                await HttpExecutor.execute(ctx);

                expect(mockFetch).toHaveBeenCalledWith(
                    'https://api.example.com/test',
                    expect.objectContaining({
                        body: '{"force": true}',
                    })
                );
            });
        });

        describe('response handling', () => {
            it('should parse JSON response', async () => {
                const responseData = { id: 123, name: 'Test Item' };

                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    headers: {
                        get: (name: string) =>
                            name === 'content-type' ? 'application/json' : null,
                    },
                    json: async () => responseData,
                });

                const ctx = createMockContext();

                const result = await HttpExecutor.execute(ctx);

                expect(result).toEqual({
                    success: true,
                    data: responseData,
                });
            });

            it('should parse text response', async () => {
                const textData = 'Plain text response';

                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    headers: {
                        get: (name: string) =>
                            name === 'content-type' ? 'text/plain' : null,
                    },
                    text: async () => textData,
                });

                const ctx = createMockContext();

                const result = await HttpExecutor.execute(ctx);

                expect(result).toEqual({
                    success: true,
                    data: textData,
                });
            });

            it('should parse JSON response with charset in content-type', async () => {
                const responseData = { result: 'ok' };

                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    headers: {
                        get: (name: string) =>
                            name === 'content-type'
                                ? 'application/json; charset=utf-8'
                                : null,
                    },
                    json: async () => responseData,
                });

                const ctx = createMockContext();

                const result = await HttpExecutor.execute(ctx);

                expect(result).toEqual({
                    success: true,
                    data: responseData,
                });
            });

            it('should handle missing content-type header as text', async () => {
                const textData = 'Some response';

                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    headers: {
                        get: () => null,
                    },
                    text: async () => textData,
                });

                const ctx = createMockContext();

                const result = await HttpExecutor.execute(ctx);

                expect(result).toEqual({
                    success: true,
                    data: textData,
                });
            });
        });

        describe('error handling', () => {
            it('should return error for non-OK response with JSON', async () => {
                const errorData = { error: 'Not found', code: 404 };

                mockFetch.mockResolvedValueOnce({
                    ok: false,
                    status: 404,
                    headers: {
                        get: (name: string) =>
                            name === 'content-type' ? 'application/json' : null,
                    },
                    json: async () => errorData,
                });

                const ctx = createMockContext();

                const result = await HttpExecutor.execute(ctx);

                expect(result).toEqual({
                    success: false,
                    error: 'HTTP 404: {"error":"Not found","code":404}',
                });
            });

            it('should return error for non-OK response with text', async () => {
                const errorText = 'Resource not found';

                mockFetch.mockResolvedValueOnce({
                    ok: false,
                    status: 404,
                    headers: {
                        get: (name: string) =>
                            name === 'content-type' ? 'text/plain' : null,
                    },
                    text: async () => errorText,
                });

                const ctx = createMockContext();

                const result = await HttpExecutor.execute(ctx);

                expect(result).toEqual({
                    success: false,
                    error: 'HTTP 404: Resource not found',
                });
            });

            it('should return error for 500 status', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: false,
                    status: 500,
                    headers: {
                        get: (name: string) =>
                            name === 'content-type' ? 'application/json' : null,
                    },
                    json: async () => ({ error: 'Internal server error' }),
                });

                const ctx = createMockContext();

                const result = await HttpExecutor.execute(ctx);

                expect(result.success).toBe(false);
                expect(result.error).toContain('HTTP 500');
            });

            it('should catch network errors', async () => {
                const networkError = new Error('Network request failed');
                mockFetch.mockRejectedValueOnce(networkError);

                const ctx = createMockContext();

                const result = await HttpExecutor.execute(ctx);

                expect(result).toEqual({
                    success: false,
                    error: 'Network request failed',
                });
            });

            it('should catch non-Error thrown values', async () => {
                mockFetch.mockRejectedValueOnce('String error');

                const ctx = createMockContext();

                const result = await HttpExecutor.execute(ctx);

                expect(result).toEqual({
                    success: false,
                    error: 'HTTP request failed',
                });
            });

            it('should handle timeout errors', async () => {
                const timeoutError = new Error('Request timeout');
                mockFetch.mockRejectedValueOnce(timeoutError);

                const ctx = createMockContext();

                const result = await HttpExecutor.execute(ctx);

                expect(result.success).toBe(false);
                expect(result.error).toBe('Request timeout');
            });
        });

        describe('default headers', () => {
            it('should include Content-Type application/json by default', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ result: 'success' }),
                });

                const ctx = createMockContext();

                await HttpExecutor.execute(ctx);

                expect(mockFetch).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.objectContaining({
                        headers: expect.objectContaining({
                            'Content-Type': 'application/json',
                        }),
                    })
                );
            });

            it('should merge custom headers with default headers', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ result: 'success' }),
                });

                const ctx = createMockContext({
                    manifest: {
                        version: 1,
                        id: 'test',
                        name: 'Test',
                        executor: {
                            type: 'http',
                            endpoint: 'https://api.example.com/test',
                            headers: {
                                'X-Custom': 'value',
                            },
                        },
                        output: { node: 'text' },
                    },
                });

                await HttpExecutor.execute(ctx);

                expect(mockFetch).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.objectContaining({
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Custom': 'value',
                        },
                    })
                );
            });

            it('should allow overriding Content-Type header', async () => {
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    headers: { get: () => 'text/plain' },
                    text: async () => 'success',
                });

                const ctx = createMockContext({
                    manifest: {
                        version: 1,
                        id: 'test',
                        name: 'Test',
                        executor: {
                            type: 'http',
                            endpoint: 'https://api.example.com/test',
                            headers: {
                                'Content-Type': 'text/plain',
                            },
                        },
                        output: { node: 'text' },
                    },
                });

                await HttpExecutor.execute(ctx);

                expect(mockFetch).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.objectContaining({
                        headers: {
                            'Content-Type': 'text/plain',
                        },
                    })
                );
            });
        });
    });
});
