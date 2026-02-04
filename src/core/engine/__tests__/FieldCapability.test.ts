/**
 * FieldCapability Tests
 * Tests for unified field port and connection resolution system
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    getDefaultCapability,
    parseFieldKeyFromHandle,
    defaultResolveConnectedValue,
    resolveWithCapability,
    SEMANTIC_HANDLES,
    type PortValue,
    type ConnectionContext,
    type FieldCapability,
} from '../FieldCapability';
import type { FieldDefinition } from '@/types/assets';
import type { SynniaNode, SynniaEdge } from '@/types/project';
import type { Asset } from '@/types/assets';

// ============================================================================
// Mock smartResolve since it's imported
// ============================================================================

vi.mock('@/domain/edge/ValueMappingService', () => ({
    smartResolveValue: vi.fn(),
}));

import { smartResolveValue } from '@/domain/edge/ValueMappingService';

// ============================================================================
// Test Data
// ============================================================================

const mockNode: SynniaNode = {
    id: 'node-1',
    type: 'form',
    position: { x: 0, y: 0 },
    data: { title: 'Source Node' },
};

const mockAsset: Asset = {
    id: 'asset-1',
    valueType: 'record',
    value: { name: 'Test', count: 42 },
    config: { schema: [] },
    sys: {
        name: 'Test Asset',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        source: 'user',
        isLibraryAsset: null,
    },
};

const mockEdge: SynniaEdge = {
    id: 'edge-1',
    source: 'node-1',
    target: 'node-2',
    sourceHandle: 'field:output',
    targetHandle: 'field:input',
};

const mockPortValue: PortValue = {
    type: 'json',
    value: { input: 'testValue', other: 'otherValue' },
};

// ============================================================================
// Tests
// ============================================================================

describe('FieldCapability', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('SEMANTIC_HANDLES', () => {
        it('should contain all expected semantic handle names', () => {
            expect(SEMANTIC_HANDLES).toEqual([
                'origin',
                'product',
                'output',
                'trigger',
                'array',
                'reference',
            ]);
        });

        it('should be a const array with proper values', () => {
            // Verify const assertion by checking the array contains expected values
            expect(SEMANTIC_HANDLES.length).toBe(6);
            expect(SEMANTIC_HANDLES.includes('origin')).toBe(true);
        });
    });

    describe('getDefaultCapability', () => {
        const createMockField = (overrides: Partial<FieldDefinition> = {}): FieldDefinition => ({
            key: 'testField',
            type: 'string',
            ...overrides,
        });

        describe('hasInputPort determination', () => {
            it('should set hasInputPort to true when connection is "input"', () => {
                const field = createMockField({ connection: 'input' });
                const result = getDefaultCapability(field);

                expect(result.hasInputPort).toBe(true);
                expect(result.hasOutputPort).toBe(false);
            });

            it('should set hasInputPort to true when connection is "both"', () => {
                const field = createMockField({ connection: 'both' });
                const result = getDefaultCapability(field);

                expect(result.hasInputPort).toBe(true);
                expect(result.hasOutputPort).toBe(true);
            });

            it('should set hasInputPort to true for object type even without connection', () => {
                const field = createMockField({ type: 'object', connection: undefined });
                const result = getDefaultCapability(field);

                expect(result.hasInputPort).toBe(true);
                expect(result.hasOutputPort).toBe(false);
            });

            it('should set hasInputPort to true for array type even without connection', () => {
                const field = createMockField({ type: 'array', connection: undefined });
                const result = getDefaultCapability(field);

                expect(result.hasInputPort).toBe(true);
                expect(result.hasOutputPort).toBe(false);
            });

            it('should set hasInputPort to false for simple types without connection', () => {
                const field = createMockField({ type: 'string', connection: undefined });
                const result = getDefaultCapability(field);

                expect(result.hasInputPort).toBe(false);
            });

            it('should set hasInputPort to false when connection is "output"', () => {
                const field = createMockField({ connection: 'output' });
                const result = getDefaultCapability(field);

                expect(result.hasInputPort).toBe(false);
                expect(result.hasOutputPort).toBe(true);
            });

            it('should set hasInputPort to false when connection is false', () => {
                const field = createMockField({ connection: false });
                const result = getDefaultCapability(field);

                expect(result.hasInputPort).toBe(false);
                expect(result.hasOutputPort).toBe(false);
            });

            it('should allow both ports when type is object and connection is output', () => {
                // Note: object type always gets inputPort due to implicit rule
                // The OR logic means type check happens regardless of connection
                const field = createMockField({ type: 'object', connection: 'output' });
                const result = getDefaultCapability(field);

                expect(result.hasInputPort).toBe(true); // object type implicitly adds input
                expect(result.hasOutputPort).toBe(true);
            });
        });

        describe('hasOutputPort determination', () => {
            it('should set hasOutputPort to true when connection is "output"', () => {
                const field = createMockField({ connection: 'output' });
                const result = getDefaultCapability(field);

                expect(result.hasOutputPort).toBe(true);
                expect(result.hasInputPort).toBe(false);
            });

            it('should set hasOutputPort to true when connection is "both"', () => {
                const field = createMockField({ connection: 'both' });
                const result = getDefaultCapability(field);

                expect(result.hasOutputPort).toBe(true);
                expect(result.hasInputPort).toBe(true);
            });

            it('should set hasOutputPort to false when connection is "input"', () => {
                const field = createMockField({ connection: 'input' });
                const result = getDefaultCapability(field);

                expect(result.hasOutputPort).toBe(false);
            });

            it('should set hasOutputPort to false when connection is undefined', () => {
                const field = createMockField({ connection: undefined });
                const result = getDefaultCapability(field);

                expect(result.hasOutputPort).toBe(false);
            });

            it('should not implicitly add output port for complex types', () => {
                const objectField = createMockField({ type: 'object', connection: undefined });
                const arrayField = createMockField({ type: 'array', connection: undefined });

                const objectResult = getDefaultCapability(objectField);
                const arrayResult = getDefaultCapability(arrayField);

                expect(objectResult.hasOutputPort).toBe(false);
                expect(arrayResult.hasOutputPort).toBe(false);
            });
        });

        describe('portId', () => {
            it('should use field key as portId', () => {
                const field = createMockField({ key: 'myCustomField' });
                const result = getDefaultCapability(field);

                expect(result.portId).toBe('myCustomField');
            });

            it('should include portId in returned capability', () => {
                const field = createMockField({ key: 'outputField', connection: 'output' });
                const result = getDefaultCapability(field);

                expect(result).toEqual({
                    hasInputPort: false,
                    hasOutputPort: true,
                    portId: 'outputField',
                });
            });
        });

        describe('combined scenarios', () => {
            it('should handle full-featured field with both ports', () => {
                const field = createMockField({
                    key: 'data',
                    type: 'object',
                    connection: 'both',
                });
                const result = getDefaultCapability(field);

                expect(result).toEqual({
                    hasInputPort: true,
                    hasOutputPort: true,
                    portId: 'data',
                });
            });

            it('should handle boolean type field', () => {
                const field = createMockField({
                    key: 'enabled',
                    type: 'boolean',
                    connection: 'input',
                });
                const result = getDefaultCapability(field);

                expect(result).toEqual({
                    hasInputPort: true,
                    hasOutputPort: false,
                    portId: 'enabled',
                });
            });

            it('should handle number type field', () => {
                const field = createMockField({
                    key: 'count',
                    type: 'number',
                    connection: undefined,
                });
                const result = getDefaultCapability(field);

                expect(result).toEqual({
                    hasInputPort: false,
                    hasOutputPort: false,
                    portId: 'count',
                });
            });
        });
    });

    describe('parseFieldKeyFromHandle', () => {
        it('should return null for null input', () => {
            const result = parseFieldKeyFromHandle(null);
            expect(result).toBeNull();
        });

        it('should return null for undefined input', () => {
            const result = parseFieldKeyFromHandle(undefined);
            expect(result).toBeNull();
        });

        it('should return null for empty string', () => {
            const result = parseFieldKeyFromHandle('');
            expect(result).toBeNull();
        });

        it('should return null for semantic handle "origin"', () => {
            const result = parseFieldKeyFromHandle('origin');
            expect(result).toBeNull();
        });

        it('should return null for semantic handle "product"', () => {
            const result = parseFieldKeyFromHandle('product');
            expect(result).toBeNull();
        });

        it('should return null for semantic handle "output"', () => {
            const result = parseFieldKeyFromHandle('output');
            expect(result).toBeNull();
        });

        it('should return null for semantic handle "trigger"', () => {
            const result = parseFieldKeyFromHandle('trigger');
            expect(result).toBeNull();
        });

        it('should return null for semantic handle "array"', () => {
            const result = parseFieldKeyFromHandle('array');
            expect(result).toBeNull();
        });

        it('should return null for semantic handle "reference"', () => {
            const result = parseFieldKeyFromHandle('reference');
            expect(result).toBeNull();
        });

        it('should extract field key from "field:xxx" format', () => {
            const result = parseFieldKeyFromHandle('field:myField');
            expect(result).toBe('myField');
        });

        it('should extract field key with hyphens from "field:xxx" format', () => {
            const result = parseFieldKeyFromHandle('field:my-custom-field');
            expect(result).toBe('my-custom-field');
        });

        it('should extract field key with numbers from "field:xxx" format', () => {
            const result = parseFieldKeyFromHandle('field:field123');
            expect(result).toBe('field123');
        });

        it('should return the handle directly if it does not start with "field:" and is not semantic', () => {
            const result = parseFieldKeyFromHandle('myDirectField');
            expect(result).toBe('myDirectField');
        });

        it('should handle handle with multiple colons after "field:" prefix', () => {
            const result = parseFieldKeyFromHandle('field:my:field:key');
            expect(result).toBe('my:field:key');
        });

        it('should not treat "field:" alone as semantic', () => {
            const result = parseFieldKeyFromHandle('field:');
            expect(result).toBe('');
        });
    });

    describe('defaultResolveConnectedValue', () => {
        const createMockContext = (overrides: Partial<ConnectionContext> = {}): ConnectionContext => ({
            edge: mockEdge,
            sourceNode: mockNode,
            sourceAsset: mockAsset,
            sourcePortValue: mockPortValue,
            fieldKey: 'input',
            ...overrides,
        });

        describe('when sourcePortValue is missing or null', () => {
            it('should return undefined when sourcePortValue is null', () => {
                const ctx = createMockContext({ sourcePortValue: null });
                const result = defaultResolveConnectedValue(ctx);

                expect(result).toBeUndefined();
            });

            it('should return undefined when sourcePortValue.value is null', () => {
                const ctx = createMockContext({
                    sourcePortValue: { type: 'json', value: null },
                });
                const result = defaultResolveConnectedValue(ctx);

                expect(result).toBeUndefined();
            });

            it('should return undefined when sourcePortValue.value is undefined', () => {
                const ctx = createMockContext({
                    sourcePortValue: { type: 'json', value: undefined },
                });
                const result = defaultResolveConnectedValue(ctx);

                expect(result).toBeUndefined();
            });
        });

        describe('when targetField is provided', () => {
            it('should call smartResolveValue with the value and targetField', () => {
                const mockTargetField: FieldDefinition = {
                    key: 'input',
                    type: 'string',
                };
                const ctx = createMockContext();
                const resolvedValue = 'resolved result';

                vi.mocked(smartResolveValue).mockReturnValue(resolvedValue);

                const result = defaultResolveConnectedValue(ctx, mockTargetField);

                expect(smartResolveValue).toHaveBeenCalledWith(mockPortValue.value, mockTargetField);
                expect(result).toBe(resolvedValue);
            });

            it('should return result from smartResolveValue even if it is null', () => {
                const mockTargetField: FieldDefinition = {
                    key: 'input',
                    type: 'string',
                };
                const ctx = createMockContext();

                vi.mocked(smartResolveValue).mockReturnValue(null);

                const result = defaultResolveConnectedValue(ctx, mockTargetField);

                expect(result).toBeNull();
            });

            it('should return result from smartResolveValue even if it is undefined', () => {
                const mockTargetField: FieldDefinition = {
                    key: 'input',
                    type: 'string',
                };
                const ctx = createMockContext();

                vi.mocked(smartResolveValue).mockReturnValue(undefined);

                const result = defaultResolveConnectedValue(ctx, mockTargetField);

                expect(result).toBeUndefined();
            });
        });

        describe('when targetField is not provided (fallback)', () => {
            it('should extract value using fieldKey when it exists in source object', () => {
                const ctx = createMockContext({
                    fieldKey: 'input',
                    sourcePortValue: {
                        type: 'json',
                        value: { input: 'extractedValue', other: 'ignored' },
                    },
                });

                const result = defaultResolveConnectedValue(ctx);

                expect(result).toBe('extractedValue');
            });

            it('should return whole object when fieldKey does not exist but value is object', () => {
                const wholeObject = { a: 1, b: 2 };
                const ctx = createMockContext({
                    fieldKey: 'nonExistent',
                    sourcePortValue: {
                        type: 'json',
                        value: wholeObject,
                    },
                });

                const result = defaultResolveConnectedValue(ctx);

                expect(result).toBe(wholeObject);
            });

            it('should return the value directly when it is not an object', () => {
                const stringValue = 'just a string';
                const ctx = createMockContext({
                    sourcePortValue: {
                        type: 'text',
                        value: stringValue,
                    },
                });

                const result = defaultResolveConnectedValue(ctx);

                expect(result).toBe(stringValue);
            });

            it('should return the value directly when it is an array', () => {
                const arrayValue = [1, 2, 3];
                const ctx = createMockContext({
                    sourcePortValue: {
                        type: 'array',
                        value: arrayValue,
                    },
                });

                const result = defaultResolveConnectedValue(ctx);

                expect(result).toBe(arrayValue);
            });

            it('should return the value directly when it is a number', () => {
                const numberValue = 42;
                const ctx = createMockContext({
                    sourcePortValue: {
                        type: 'json',
                        value: numberValue,
                    },
                });

                const result = defaultResolveConnectedValue(ctx);

                expect(result).toBe(42);
            });

            it('should return the value directly when it is a boolean', () => {
                const ctx = createMockContext({
                    sourcePortValue: {
                        type: 'json',
                        value: true,
                    },
                });

                const result = defaultResolveConnectedValue(ctx);

                expect(result).toBe(true);
            });

            it('should handle nested objects correctly', () => {
                const nestedObject = { nested: { deeply: { value: 'found' } } };
                const ctx = createMockContext({
                    fieldKey: 'nested',
                    sourcePortValue: {
                        type: 'json',
                        value: nestedObject,
                    },
                });

                const result = defaultResolveConnectedValue(ctx);

                expect(result).toEqual({ deeply: { value: 'found' } });
            });

            it('should handle fieldKey with special characters', () => {
                const ctx = createMockContext({
                    fieldKey: 'field-name-with-dashes',
                    sourcePortValue: {
                        type: 'json',
                        value: { 'field-name-with-dashes': 'value' },
                    },
                });

                const result = defaultResolveConnectedValue(ctx);

                expect(result).toBe('value');
            });
        });

        describe('edge cases', () => {
            it('should handle empty object value', () => {
                const ctx = createMockContext({
                    fieldKey: 'someKey',
                    sourcePortValue: {
                        type: 'json',
                        value: {},
                    },
                });

                const result = defaultResolveConnectedValue(ctx);

                expect(result).toEqual({});
            });

            it('should handle object with null values', () => {
                const ctx = createMockContext({
                    fieldKey: 'existingKey',
                    sourcePortValue: {
                        type: 'json',
                        value: { existingKey: null, otherKey: 'value' },
                    },
                });

                const result = defaultResolveConnectedValue(ctx);

                expect(result).toBeNull();
            });
        });
    });

    describe('resolveWithCapability', () => {
        const createMockContext = (overrides: Partial<ConnectionContext> = {}): ConnectionContext => ({
            edge: mockEdge,
            sourceNode: mockNode,
            sourceAsset: mockAsset,
            sourcePortValue: mockPortValue,
            fieldKey: 'input',
            ...overrides,
        });

        it('should use custom resolver when provided in capability', () => {
            const customResolver = vi.fn().mockReturnValue('custom result');
            const capability: FieldCapability = {
                hasInputPort: true,
                hasOutputPort: false,
                resolveConnectedValue: customResolver,
            };
            const ctx = createMockContext();

            const result = resolveWithCapability(capability, ctx);

            expect(customResolver).toHaveBeenCalledWith(ctx);
            expect(result).toBe('custom result');
        });

        it('should not call default resolver when custom resolver is provided', () => {
            const customResolver = vi.fn().mockReturnValue('custom result');
            const capability: FieldCapability = {
                hasInputPort: true,
                hasOutputPort: false,
                resolveConnectedValue: customResolver,
            };
            const ctx = createMockContext();

            resolveWithCapability(capability, ctx);

            expect(smartResolveValue).not.toHaveBeenCalled();
        });

        it('should use default resolver when no custom resolver is provided', () => {
            const targetField: FieldDefinition = {
                key: 'input',
                type: 'string',
            };
            const capability: FieldCapability = {
                hasInputPort: true,
                hasOutputPort: false,
                targetField,
            };
            const ctx = createMockContext();

            vi.mocked(smartResolveValue).mockReturnValue('default resolved');

            const result = resolveWithCapability(capability, ctx);

            expect(smartResolveValue).toHaveBeenCalledWith(mockPortValue.value, targetField);
            expect(result).toBe('default resolved');
        });

        it('should use default resolver when resolveConnectedValue is undefined', () => {
            const capability: FieldCapability = {
                hasInputPort: true,
                hasOutputPort: false,
            };
            const ctx = createMockContext();

            // Since no targetField, fallback to simple key extraction
            const result = resolveWithCapability(capability, ctx);

            expect(result).toBe('testValue'); // from mockPortValue.value.input
        });

        it('should call custom resolver with full context', () => {
            const customResolver = vi.fn();
            const capability: FieldCapability = {
                hasInputPort: true,
                hasOutputPort: false,
                resolveConnectedValue: customResolver,
            };
            const specificCtx: ConnectionContext = {
                edge: { id: 'edge-123', source: 'src', target: 'tgt' },
                sourceNode: { id: 'src', type: 'form', position: { x: 0, y: 0 }, data: {} },
                sourceAsset: null,
                sourcePortValue: { type: 'json', value: { data: 123 } },
                fieldKey: 'myField',
            };

            resolveWithCapability(capability, specificCtx);

            expect(customResolver).toHaveBeenCalledWith(specificCtx);
        });

        it('should pass targetField from capability to default resolver', () => {
            const targetField: FieldDefinition = {
                key: 'target',
                type: 'number',
                required: true,
            };
            const capability: FieldCapability = {
                hasInputPort: true,
                hasOutputPort: false,
                targetField,
            };
            const ctx = createMockContext();

            resolveWithCapability(capability, ctx);

            expect(smartResolveValue).toHaveBeenCalledWith(mockPortValue.value, targetField);
        });

        it('should handle custom resolver returning undefined', () => {
            const customResolver = vi.fn().mockReturnValue(undefined);
            const capability: FieldCapability = {
                hasInputPort: true,
                hasOutputPort: false,
                resolveConnectedValue: customResolver,
            };
            const ctx = createMockContext();

            const result = resolveWithCapability(capability, ctx);

            expect(result).toBeUndefined();
        });

        it('should handle custom resolver returning null', () => {
            const customResolver = vi.fn().mockReturnValue(null);
            const capability: FieldCapability = {
                hasInputPort: true,
                hasOutputPort: false,
                resolveConnectedValue: customResolver,
            };
            const ctx = createMockContext();

            const result = resolveWithCapability(capability, ctx);

            expect(result).toBeNull();
        });

        it('should handle custom resolver throwing error', () => {
            const customResolver = vi.fn().mockImplementation(() => {
                throw new Error('Resolution failed');
            });
            const capability: FieldCapability = {
                hasInputPort: true,
                hasOutputPort: false,
                resolveConnectedValue: customResolver,
            };
            const ctx = createMockContext();

            expect(() => resolveWithCapability(capability, ctx)).toThrow('Resolution failed');
        });
    });

    describe('integration scenarios', () => {
        it('should handle typical reference-style widget scenario', () => {
            // Reference widgets create { nodeId, title, ... } instead of extracting value
            const referenceResolver = (ctx: ConnectionContext) => ({
                nodeId: ctx.sourceNode.id,
                title: ctx.sourceNode.data.title || 'Untitled',
            });

            const capability: FieldCapability = {
                hasInputPort: true,
                hasOutputPort: false,
                resolveConnectedValue: referenceResolver,
            };

            const ctx: ConnectionContext = {
                edge: { id: 'e1', source: 'n1', target: 'n2' },
                sourceNode: {
                    id: 'node-abc',
                    type: 'form',
                    position: { x: 100, y: 100 },
                    data: { title: 'My Form Node' },
                },
                sourceAsset: null,
                sourcePortValue: null,
                fieldKey: 'referenceField',
            };

            const result = resolveWithCapability(capability, ctx);

            expect(result).toEqual({
                nodeId: 'node-abc',
                title: 'My Form Node',
            });
        });

        it('should handle typed field extraction with smart resolve', () => {
            const targetField: FieldDefinition = {
                key: 'count',
                type: 'number',
                required: true,
            };

            const capability: FieldCapability = {
                hasInputPort: true,
                hasOutputPort: false,
                targetField,
            };

            const ctx: ConnectionContext = {
                edge: { id: 'e1', source: 'n1', target: 'n2' },
                sourceNode: { id: 'n1', type: 'text', position: { x: 0, y: 0 }, data: {} },
                sourceAsset: null,
                sourcePortValue: {
                    type: 'json',
                    value: { count: 42, name: 'test' },
                },
                fieldKey: 'count',
            };

            vi.mocked(smartResolveValue).mockReturnValue(42);

            const result = resolveWithCapability(capability, ctx);

            expect(smartResolveValue).toHaveBeenCalledWith({ count: 42, name: 'test' }, targetField);
            expect(result).toBe(42);
        });
    });
});
