// Executor Tests
// Tests for recipe executors and utility functions
// Note: HTTP, LLM, and Media executors need mocked external calls

import { describe, it, expect } from 'vitest';
import {
    createExecutor,
    interpolate,
    extractValue,
    extractText,
    extractNumber,
} from '../index';
import { ExecutionContext } from '@/types/recipe';

// Helper to create mock ExecutionContext
const createMockContext = (inputs: Record<string, any>): ExecutionContext => ({
    node: { id: 'test-node' } as any,
    nodeId: 'test-node',
    inputs,
    engine: {} as any,
    manifest: undefined as any, // Test contexts don't need manifest
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('interpolate', () => {
    it('should replace {{key}} with value', () => {
        const result = interpolate('Hello {{name}}!', { name: 'World' });
        expect(result).toBe('Hello World!');
    });

    it('should handle multiple placeholders', () => {
        const result = interpolate('{{a}} + {{b}} = {{c}}', { a: '1', b: '2', c: '3' });
        expect(result).toBe('1 + 2 = 3');
    });

    it('should replace missing keys with empty string', () => {
        const result = interpolate('Hello {{name}}!', {});
        expect(result).toBe('Hello !');
    });

    it('should handle no placeholders', () => {
        const result = interpolate('No placeholders here', { foo: 'bar' });
        expect(result).toBe('No placeholders here');
    });

    it('should extract nested values', () => {
        const result = interpolate('Value: {{data}}', { data: { content: 'nested' } });
        expect(result).toBe('Value: nested');
    });
});

describe('extractValue', () => {
    it('should return primitive values as-is', () => {
        expect(extractValue('hello')).toBe('hello');
        expect(extractValue(42)).toBe(42);
        expect(extractValue(true)).toBe(true);
        expect(extractValue(null)).toBe(null);
    });

    it('should extract .content from wrapped objects', () => {
        expect(extractValue({ content: 'inner' })).toBe('inner');
    });

    it('should extract .value from wrapped objects', () => {
        expect(extractValue({ value: 'inner' })).toBe('inner');
    });

    it('should prefer .content over .value', () => {
        expect(extractValue({ content: 'content', value: 'value' })).toBe('content');
    });

    it('should return object as-is if no content/value', () => {
        const obj = { foo: 'bar' };
        expect(extractValue(obj)).toBe(obj);
    });
});

describe('extractText', () => {
    it('should convert values to string', () => {
        expect(extractText('hello')).toBe('hello');
        expect(extractText(42)).toBe('42');
        expect(extractText(true)).toBe('true');
    });

    it('should handle null/undefined', () => {
        expect(extractText(null)).toBe('');
        expect(extractText(undefined)).toBe('');
    });

    it('should extract text from wrapped objects', () => {
        expect(extractText({ content: 'wrapped' })).toBe('wrapped');
    });
});

describe('extractNumber', () => {
    it('should convert values to number', () => {
        expect(extractNumber('42')).toBe(42);
        expect(extractNumber(42)).toBe(42);
        expect(extractNumber('3.14')).toBe(3.14);
    });

    it('should handle null/undefined as 0', () => {
        expect(extractNumber(null)).toBe(0);
        expect(extractNumber(undefined)).toBe(0);
    });

    it('should extract number from wrapped objects', () => {
        expect(extractNumber({ value: '100' })).toBe(100);
    });
});

// ============================================================================
// Template Executor Tests
// ============================================================================

describe('createExecutor - template', () => {
    it('should create template executor', () => {
        const executor = createExecutor({
            type: 'template',
            template: 'Hello {{name}}!',
        });

        expect(typeof executor).toBe('function');
    });

    it('should execute template with inputs', async () => {
        const executor = createExecutor({
            type: 'template',
            template: 'Hello {{name}}!',
        });

        const result = await executor(createMockContext({ name: 'World' }));

        expect(result.success).toBe(true);
        expect(result.data?.result).toBe('Hello World!');
    });

    it('should use custom outputKey', async () => {
        const executor = createExecutor({
            type: 'template',
            template: '{{text}}',
            outputKey: 'output',
        });

        const result = await executor(createMockContext({ text: 'test' }));

        expect(result.data?.output).toBe('test');
    });

    it('should handle wrapped input values', async () => {
        const executor = createExecutor({
            type: 'template',
            template: 'Value: {{data}}',
        });

        const result = await executor(createMockContext({ data: { content: 'nested value' } }));

        expect(result.data?.result).toBe('Value: nested value');
    });
});

// ============================================================================
// Expression Executor Tests
// ============================================================================

describe('createExecutor - expression', () => {
    it('should evaluate simple expression', async () => {
        const executor = createExecutor({
            type: 'expression',
            expression: 'a + b',
        });

        const result = await executor(createMockContext({ a: 1, b: 2 }));

        expect(result.success).toBe(true);
        expect(result.data?.result).toBe(3);
    });

    it('should evaluate string concatenation', async () => {
        const executor = createExecutor({
            type: 'expression',
            expression: 'first + " " + last',
        });

        const result = await executor(createMockContext({ first: 'Hello', last: 'World' }));

        expect(result.data?.result).toBe('Hello World');
    });

    it('should handle array operations', async () => {
        const executor = createExecutor({
            type: 'expression',
            expression: 'items.length',
        });

        const result = await executor(createMockContext({ items: [1, 2, 3, 4, 5] }));

        expect(result.data?.result).toBe(5);
    });

    it('should handle wrapped values', async () => {
        const executor = createExecutor({
            type: 'expression',
            expression: 'x * 2',
        });

        const result = await executor(createMockContext({ x: { value: 10 } }));

        expect(result.data?.result).toBe(20);
    });

    it('should return error for invalid expression', async () => {
        const executor = createExecutor({
            type: 'expression',
            expression: 'undefined_var.property',
        });

        const result = await executor(createMockContext({}));

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
    });
});

// ============================================================================
// Executor Factory Tests
// ============================================================================

describe('createExecutor - factory', () => {
    it('should throw for unknown executor type', () => {
        expect(() => createExecutor({ type: 'unknown-nonexistent-type' })).toThrow('Unknown executor type');
    });

    it('should throw for custom executor type', () => {
        expect(() => createExecutor({ type: 'custom' })).toThrow('Custom executors should be loaded');
    });
});

